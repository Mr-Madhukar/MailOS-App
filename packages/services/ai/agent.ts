import { isOpenAiConfigured } from "./openai";
import type { AgentFocus } from "./agent-focus";
import { runAgentChatStream } from "./agent-stream";

export type AgentHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentActionCard = {
  kind: "email_queued" | "calendar_queued" | "inbox_search" | "inbox_ranked" | "queue_list" | "thread" | "calendar" | "email";
  title: string;
  detail?: string;
  href?: string;
  lines?: string[];
  disposition?: "sent" | "queued";
  queueItemId?: string;
  threadId?: string;
};

export type AgentChatResult = {
  reply: string;
  actions: AgentActionCard[];
  focusCleared?: boolean;
  effectiveFocus?: AgentFocus;
  toolMemory?: import("./agent-tool-memory").AgentToolMemoryEntry[];
  newToolMemoryEntries?: import("./agent-tool-memory").AgentToolMemoryEntry[];
};

export function isAgentConfigured() {
  return isOpenAiConfigured();
}

export async function runAgentChat(
  tenantId: string,
  input: {
    message: string;
    history?: AgentHistoryMessage[];
    userEmail?: string;
    focus?: AgentFocus;
    toolMemory?: import("./agent-tool-memory").AgentToolMemoryEntry[];
  },
): Promise<AgentChatResult> {
  return runAgentChatStream(tenantId, input, () => {});
}
