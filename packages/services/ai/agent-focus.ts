import { getCalendarService } from "../calendar";
import { getInboxService } from "../inbox";
import { summarizeThread } from "./summarize-thread";

export type AgentFocus = {
  threadId?: string;
  eventId?: string;
};

async function buildThreadFocusLines(
  tenantId: string,
  threadId: string,
  userEmail?: string,
): Promise<string[]> {
  try {
    const summary = await summarizeThread({ tenantId, threadId, userEmail });
    return [
      "Type: EMAIL THREAD (Gmail)",
      `threadId: ${threadId}`,
      `subject: ${summary.subject}`,
      `summary: ${summary.summary}`,
      summary.actionItems.length
        ? `action items: ${summary.actionItems.map((a) => a.action).join("; ")}`
        : "",
      `next step: ${summary.nextStep}`,
      "",
      'When the user says "this", "this one", "summarize", "tell me about this", or "this event" in an email/inbox context, they mean THIS EMAIL THREAD — not Google Calendar.',
      `Use summarize_thread or get_thread with threadId "${threadId}".`,
      "Only use calendar tools if the user explicitly asks about calendar, meetings, schedule, or appointment times.",
    ];
  } catch {
    const inbox = getInboxService();
    const thread = await inbox.getThread(tenantId, threadId, { userEmail });
    return [
      "Type: EMAIL THREAD (Gmail)",
      `threadId: ${threadId}`,
      `subject: ${thread?.subject?.trim() || "(unknown)"}`,
      "",
      'User references like "this email" or "summarize this" mean this threadId. Use get_thread or summarize_thread.',
    ];
  }
}

async function buildEventFocusLines(
  tenantId: string,
  eventId: string,
): Promise<string[]> {
  const calendar = getCalendarService();
  const event = await calendar.getEvent(tenantId, eventId);
  if (!event) {
    return [
      "",
      "Type: CALENDAR EVENT",
      `eventId: ${eventId}`,
      "Use get_calendar_event with this id.",
    ];
  }
  return [
    "",
    "Type: CALENDAR EVENT",
    `eventId: ${eventId}`,
    `title: ${event.summary}`,
    event.start ? `starts: ${event.start}` : "",
    event.description ? `description: ${event.description.slice(0, 400)}` : "",
    "",
    'When the user says "this meeting" or "this event" with calendar context, use get_calendar_event with this eventId.',
  ];
}

export async function buildFocusSystemAppendix(
  tenantId: string,
  focus: AgentFocus | undefined,
  userEmail?: string,
): Promise<string> {
  const threadId = focus?.threadId?.trim();
  const eventId = focus?.eventId?.trim();
  if (!threadId && !eventId) return "";

  const lines = [
    "",
    "═══ CURRENT USER FOCUS (highest priority — overrides older chat topics) ═══",
  ];

  if (threadId) {
    lines.push(...(await buildThreadFocusLines(tenantId, threadId, userEmail)));
  }

  if (eventId) {
    lines.push(...(await buildEventFocusLines(tenantId, eventId)));
  }

  return lines.filter(Boolean).join("\n");
}
