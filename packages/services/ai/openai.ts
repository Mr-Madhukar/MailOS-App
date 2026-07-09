import { ServiceError } from "../errors";

import { fetchOpenAi } from "./openai-fetch";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 60_000;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
}

export function getOpenAiModel() {
  const model = process.env.OPENAI_MODEL?.trim();
  if (model) return model;

  // Fallback to openai/gpt-4o-mini if using OpenRouter key
  if (!process.env.OPENAI_API_KEY?.trim() && process.env.OPENROUTER_API_KEY?.trim()) {
    return "openai/gpt-4o-mini";
  }
  return DEFAULT_MODEL;
}

export function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || null;
}

export function getOpenAiEndpoint() {
  if (!process.env.OPENAI_API_KEY?.trim() && process.env.OPENROUTER_API_KEY?.trim()) {
    return "https://openrouter.ai/api/v1/chat/completions";
  }
  return "https://api.openai.com/v1/chat/completions";
}

export async function createChatCompletion(
  messages: ChatMessage[],
  opts?: { temperature?: number; jsonObject?: boolean },
) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new ServiceError("PRECONDITION_FAILED", "AI is not configured. Set OPENAI_API_KEY or OPENROUTER_API_KEY.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const url = getOpenAiEndpoint();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (url.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = "http://localhost:3000";
      headers["X-Title"] = "MailOS";
    }

    const response = await fetchOpenAi(
      url,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: getOpenAiModel(),
          messages,
          temperature: opts?.temperature ?? 0.2,
          ...(opts?.jsonObject ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: controller.signal,
      },
      { label: "openai.chat.completions" },
    );

    const payload = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string | null } }>;
    };

    if (!response.ok) {
      throw new ServiceError(
        "INTERNAL",
        payload.error?.message?.trim() || "AI request failed. Try again shortly.",
      );
    }

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new ServiceError("INTERNAL", "AI returned an empty response.");
    }

    return content;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError("INTERNAL", "AI request timed out.");
    }
    throw new ServiceError("INTERNAL", "AI request failed. Try again shortly.");
  } finally {
    clearTimeout(timeout);
  }
}
