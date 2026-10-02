export type AgentToolMemoryEntry = {
  at: string;
  tool: string;
  summary: string;
  threadId?: string;
  eventId?: string;
  query?: string;
};

export const MAX_TOOL_MEMORY_ENTRIES = 12;

const MEMORY_TOOLS = new Set([
  "search_inbox",
  "list_inbox",
  "get_thread",
  "summarize_thread",
  "rank_inbox",
  "list_calendar_events",
  "get_calendar_event",
  "list_queue",
]);

export function shouldRememberTool(toolName: string): boolean {
  return MEMORY_TOOLS.has(toolName);
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function clip(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function resolveSender(row: Record<string, unknown> | null | undefined): string {
  if (typeof row?.fromName === "string") {
    return row.fromName;
  }
  if (typeof row?.from === "string") {
    return row.from;
  }
  return "";
}

function summarizeInboxList(data: Record<string, unknown> | null, query?: string): string {
  const count = typeof data?.count === "number" ? data.count : undefined;
  const threads = Array.isArray(data?.threads) ? data.threads : [];
  const topSubjects = threads
    .slice(0, 3)
    .map((t) => {
      if (!t || typeof t !== "object") return "";
      const row = t as Record<string, unknown>;
      const subject = typeof row.subject === "string" ? row.subject.trim() : "";
      if (!subject) return "";
      const from = resolveSender(row);
      const fromSuffix = from ? ` (${from})` : "";
      return `${subject}${fromSuffix}`;
    })
    .filter(Boolean);
  const subjectSuffix = topSubjects.length > 0 ? `: ${topSubjects.join("; ")}` : "";
  const totalCount = count ?? threads.length;
  const summary = query
    ? `Searched inbox for "${query}" — ${totalCount} thread(s)${subjectSuffix}`
    : `Listed ${totalCount} recent inbox thread(s)${subjectSuffix}`;
  return clip(summary);
}

function summarizeGetThread(data: Record<string, unknown> | null): string {
  const thread =
    data?.thread && typeof data.thread === "object" ? (data.thread as Record<string, unknown>) : null;
  const subject = typeof thread?.subject === "string" ? thread.subject.trim() : "Thread";
  const from = resolveSender(thread);
  const fromSuffix = from ? ` from ${from}` : "";
  return clip(`Read thread "${subject}"${fromSuffix}`);
}

function summarizeThreadSummary(data: Record<string, unknown> | null): string {
  const subject = typeof data?.subject === "string" ? data.subject.trim() : "Thread";
  const next = typeof data?.nextStep === "string" ? data.nextStep.trim() : "";
  const nextSuffix = next ? ` — next: ${next}` : "";
  return clip(`Summarized "${subject}"${nextSuffix}`);
}

function summarizeRankInbox(data: Record<string, unknown> | null): string {
  const items = Array.isArray(data?.items) ? data.items : [];
  const top = items
    .slice(0, 3)
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const row = item as Record<string, unknown>;
      const subject = typeof row.subject === "string" ? row.subject.trim() : "";
      if (!subject) return "";
      const urgency = typeof row.urgency === "string" ? row.urgency : "";
      return `${subject} [${urgency}]`;
    })
    .filter(Boolean);
  const topSuffix = top.length > 0 ? `: ${top.join("; ")}` : "";
  return clip(`Ranked inbox urgency${topSuffix}`);
}

function summarizeCalendarList(data: Record<string, unknown> | null): string {
  const events = Array.isArray(data?.events) ? data.events : [];
  const top = events
    .slice(0, 3)
    .map((e) => {
      if (!e || typeof e !== "object") return "";
      const row = e as Record<string, unknown>;
      return typeof row.summary === "string" ? row.summary.trim() : "";
    })
    .filter(Boolean);
  const topSuffix = top.length > 0 ? `: ${top.join("; ")}` : "";
  return clip(`Listed ${events.length} calendar event(s)${topSuffix}`);
}

function summarizeGetEvent(data: Record<string, unknown> | null): string {
  const event =
    data?.event && typeof data.event === "object" ? (data.event as Record<string, unknown>) : null;
  const title = typeof event?.summary === "string" ? event.summary.trim() : "Event";
  const start = typeof event?.start === "string" ? event.start : "";
  const startSuffix = start ? ` at ${start}` : "";
  return clip(`Read calendar event "${title}"${startSuffix}`);
}

export function summarizeToolResult(
  toolName: string,
  rawResult: string,
  args: Record<string, unknown>,
): AgentToolMemoryEntry | null {
  if (!shouldRememberTool(toolName)) return null;

  const at = new Date().toISOString();
  const data = safeParseJson(rawResult);
  const threadId = typeof args.threadId === "string" ? args.threadId.trim() : undefined;
  const eventId = typeof args.eventId === "string" ? args.eventId.trim() : undefined;
  const query = typeof args.query === "string" ? args.query.trim() : undefined;

  switch (toolName) {
    case "search_inbox":
    case "list_inbox":
      return { at, tool: toolName, summary: summarizeInboxList(data, query), query };

    case "get_thread":
      return { at, tool: toolName, summary: summarizeGetThread(data), threadId };

    case "summarize_thread":
      return { at, tool: toolName, summary: summarizeThreadSummary(data), threadId };

    case "rank_inbox":
      return { at, tool: toolName, summary: summarizeRankInbox(data) };

    case "list_calendar_events":
      return { at, tool: toolName, summary: summarizeCalendarList(data) };

    case "get_calendar_event":
      return { at, tool: toolName, summary: summarizeGetEvent(data), eventId };

    case "list_queue": {
      const items = Array.isArray(data?.items) ? data.items : [];
      return {
        at,
        tool: toolName,
        summary: clip(`Queue has ${items.length} pending item(s)`),
      };
    }

    default:
      return { at, tool: toolName, summary: clip(`${toolName} completed`) };
  }
}

export function appendToolMemory(
  existing: AgentToolMemoryEntry[],
  entry: AgentToolMemoryEntry,
): AgentToolMemoryEntry[] {
  return [...existing, entry].slice(-MAX_TOOL_MEMORY_ENTRIES);
}

export function mergeToolMemory(
  existing: AgentToolMemoryEntry[],
  newEntries: AgentToolMemoryEntry[],
): AgentToolMemoryEntry[] {
  if (newEntries.length === 0) return existing;
  return [...existing, ...newEntries].slice(-MAX_TOOL_MEMORY_ENTRIES);
}

export function formatToolMemoryForPrompt(entries: AgentToolMemoryEntry[]): string {
  if (!entries.length) return "";

  const lines = entries.map((e) => {
    const parts = [`- [${e.tool}] ${e.summary}`];
    if (e.threadId) parts.push(`threadId=${e.threadId}`);
    if (e.eventId) parts.push(`eventId=${e.eventId}`);
    if (e.query) parts.push(`query="${e.query}"`);
    return parts.join(" ");
  });

  return [
    "",
    "═══ RECENT TOOL RESULTS (structured memory — prefer over stale chat topics) ═══",
    ...lines,
    "When the user asks follow-up questions without naming a new subject, use these results before re-searching.",
  ].join("\n");
}
