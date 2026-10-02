import { ServiceError } from "../errors";

import { fetchOpenAi } from "./openai-fetch";
import { getOpenAiModel, isOpenAiConfigured, getOpenAiApiKey, getOpenAiEndpoint } from "./openai";

const DEFAULT_TIMEOUT_MS = 60_000;
/** Hard ceiling on tool-call rounds. Must match the maxRounds passed by runAgentChat. */
const MAX_TOOL_ROUNDS = 6;

export type OpenAiToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type OpenAiConversationMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

function handleFetchChoiceError(error: unknown, signal?: AbortSignal): never {
  if (error instanceof ServiceError) throw error;
  if (signal?.aborted) {
    throw new ServiceError("INTERNAL", "Agent request cancelled.");
  }
  if (error instanceof Error && error.name === "AbortError") {
    throw new ServiceError("INTERNAL", "OpenAI request timed out.");
  }
  throw new ServiceError("INTERNAL", "OpenAI request failed. Try again shortly.");
}

async function executeToolCalls(
  toolCalls: ToolCall[],
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  transcript: OpenAiConversationMessage[],
): Promise<void> {
  const toolResults = await Promise.all(
    toolCalls.map(async (call) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
      } catch {
        args = {};
      }

      let result: string;
      try {
        result = await executeTool(call.function.name, args);
      } catch (error) {
        result = JSON.stringify({
          error: error instanceof Error ? error.message : "Tool execution failed",
        });
      }

      return {
        role: "tool" as const,
        tool_call_id: call.id,
        content: result,
      };
    }),
  );

  transcript.push(...toolResults);
}

async function fetchChoiceWithTimeout(
  transcript: OpenAiConversationMessage[],
  tools: OpenAiToolDefinition[],
  timeoutMs: number,
  signal?: AbortSignal,
  onToken?: (delta: string) => void,
): Promise<{ content?: string | null; tool_calls?: ToolCall[] }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);

  try {
    return await fetchOpenAiChoice(transcript, tools, controller.signal, onToken);
  } catch (error) {
    handleFetchChoiceError(error, signal);
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

export async function runOpenAiToolLoop(
  messages: OpenAiConversationMessage[],
  tools: OpenAiToolDefinition[],
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  opts?: { maxRounds?: number; timeoutMs?: number; onToken?: (delta: string) => void; signal?: AbortSignal },
): Promise<{ content: string; messages: OpenAiConversationMessage[] }> {
  if (!isOpenAiConfigured()) {
    throw new ServiceError("PRECONDITION_FAILED", "OpenAI is not configured. Set OPENAI_API_KEY.");
  }

  const maxRounds = opts?.maxRounds ?? MAX_TOOL_ROUNDS;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const transcript = [...messages];

  for (let round = 0; round < maxRounds; round += 1) {
    if (opts?.signal?.aborted) {
      throw new ServiceError("INTERNAL", "Agent request cancelled.");
    }

    const choice = await fetchChoiceWithTimeout(transcript, tools, timeoutMs, opts?.signal, opts?.onToken);

    if (choice.tool_calls?.length) {
      transcript.push({
        role: "assistant",
        content: choice.content ?? null,
        tool_calls: choice.tool_calls,
      });

      await executeToolCalls(choice.tool_calls, executeTool, transcript);
      continue;
    }

    const content = choice.content?.trim();
    if (!content) {
      throw new ServiceError("INTERNAL", "OpenAI returned an empty response.");
    }

    transcript.push({ role: "assistant", content });
    return { content, messages: transcript };
  }

  throw new ServiceError(
    "INTERNAL",
    "I ran out of steps before completing your request. Try breaking it into smaller tasks.",
  );
}

type StreamDeltaToolCall = {
  index: number;
  id?: string;
  type?: "function";
  function?: { name?: string; arguments?: string };
};

type StreamChunkPayload = {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: StreamDeltaToolCall[];
    };
  }>;
};

function updateToolCallMap(toolCalls: Map<number, ToolCall>, deltas: StreamDeltaToolCall[]): void {
  for (const toolDelta of deltas) {
    const existing = toolCalls.get(toolDelta.index) ?? {
      id: toolDelta.id ?? "",
      type: "function" as const,
      function: { name: "", arguments: "" },
    };
    if (toolDelta.id) existing.id = toolDelta.id;
    if (toolDelta.function?.name) existing.function.name = toolDelta.function.name;
    if (toolDelta.function?.arguments) {
      existing.function.arguments += toolDelta.function.arguments;
    }
    toolCalls.set(toolDelta.index, existing);
  }
}

function processStreamDataLine(
  line: string,
  toolCalls: Map<number, ToolCall>,
  onToken?: (delta: string) => void,
): string {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data: ")) return "";
  const dataStr = trimmed.slice(6);
  if (dataStr === "[DONE]") return "";

  let parsed: StreamChunkPayload;
  try {
    parsed = JSON.parse(dataStr) as StreamChunkPayload;
  } catch {
    return "";
  }

  const delta = parsed.choices?.[0]?.delta;
  if (!delta) return "";

  if (delta.tool_calls) {
    updateToolCallMap(toolCalls, delta.tool_calls);
  }

  if (delta.content) {
    onToken?.(delta.content);
    return delta.content;
  }
  return "";
}

async function consumeStreamResponse(
  body: ReadableStream<Uint8Array>,
  onToken?: (delta: string) => void,
): Promise<{ content?: string | null; tool_calls?: ToolCall[] }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls = new Map<number, ToolCall>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      content += processStreamDataLine(line, toolCalls, onToken);
    }
  }

  const tool_calls = toolCalls.size
    ? Array.from(toolCalls.entries())
        .sort(([a], [b]) => a - b)
        .map(([, call]) => call)
    : undefined;

  return { content: content || null, tool_calls };
}

async function parseStaticResponse(
  response: Response,
): Promise<{ content?: string | null; tool_calls?: ToolCall[] }> {
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
  };
  const choice = payload.choices?.[0]?.message;
  if (!choice) {
    throw new ServiceError("INTERNAL", "OpenAI returned an empty response.");
  }
  return choice;
}

async function fetchOpenAiChoice(
  transcript: OpenAiConversationMessage[],
  tools: OpenAiToolDefinition[],
  signal: AbortSignal,
  onToken?: (delta: string) => void,
): Promise<{ content?: string | null; tool_calls?: ToolCall[] }> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new ServiceError("PRECONDITION_FAILED", "AI is not configured.");
  const useStream = Boolean(onToken);

  const url = getOpenAiEndpoint();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (url.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = process.env.CLIENT_URL || "https://mailos.mrmadhukar.in";
    headers["X-Title"] = "MailOS";
  }

  const response = await fetchOpenAi(
    url,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: getOpenAiModel(),
        messages: transcript,
        tools,
        tool_choice: "auto",
        temperature: 0.2,
        stream: useStream,
      }),
      signal,
    },
    { label: useStream ? "openai.chat.tools.stream" : "openai.chat.tools" },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new ServiceError(
      "INTERNAL",
      payload.error?.message?.trim() || "OpenAI request failed. Try again shortly.",
    );
  }

  if (!useStream || !response.body) {
    return parseStaticResponse(response);
  }

  return consumeStreamResponse(response.body, onToken);
}
