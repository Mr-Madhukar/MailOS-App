/**
 * Shared tool-executor factory for the Thread Agent.
 *
 * Both `agent.ts` (blocking) and `agent-stream.ts` (SSE streaming) build their
 * `executeTool` function from this single source of truth, eliminating the ~450-
 * line duplication that previously existed between the two files.
 *
 * 57 tools — in full parity with the MCP server (see mcp-server.json).
 */

import { logger } from "@repo/logger";
import type { CalendarService } from "../calendar";
import { getContactsService } from "../contacts";
import { ServiceError } from "../errors";
import type { InboxService } from "../inbox";
import type { QueueService } from "../queue";
import type { ApprovalDefaults } from "../settings";
import { getContactIntel } from "./contact-intel";
import {
  enforceEmailSendCap,
  fenceEmailData,
  validateAgentEmailArgs,
  type SendCounter,
} from "./agent-guard";
import { generateDailyBrief } from "./daily-brief";
import { getMeetingPrep } from "./meeting-prep";
import { getMissedFollowUps } from "./missed-followups";
import { analyzeInboxThreads } from "./inbox-priority";
import { getSmartReplies } from "./smart-reply";
import { getThreadContext } from "./thread-context";
import { summarizeThread } from "./summarize-thread";
import { threadLine } from "./agent-internals";
import type { AgentActionCard } from "./agent";

export type AgentExecutorContext = {
  tenantId: string;
  userEmail?: string;
  approvalDefaults: ApprovalDefaults;
  inbox: InboxService;
  queue: QueueService;
  calendar: CalendarService;
  actions: AgentActionCard[];
  emailQueueFingerprints: Set<string>;
  sendCounter: SendCounter;
};

function getString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

/**
 * Returns the async `executeTool(name, args)` function used by `runOpenAiToolLoop`.
 * Wrap the returned function to inject `onToolCall(name)` for streaming status events.
 */
async function executeAgentRankInbox(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, inbox, actions } = ctx;
  const maxResults = Math.min(Math.max(Number(args.maxResults) || 15, 1), 25);
  const listed = await inbox.listThreads(tenantId, { maxResults });
  const analysis = await analyzeInboxThreads(
    listed.threads.map((t) => ({ id: t.id, snippet: t.snippet, subject: t.subject, from: t.fromName ?? t.from })),
  );
  const byId = new Map(listed.threads.map((t) => [t.id, t]));
  const ordered = analysis.rankedIds.map((id) => byId.get(id)).filter(Boolean);
  const topLines = analysis.items
    .filter((item) => item.urgency !== "noise")
    .slice(0, 8)
    .map((item) => {
      const thread = byId.get(item.id);
      const label = thread ? threadLine(thread) : item.id;
      return `[${item.urgency.toUpperCase()} · ${item.score}] ${label} — ${item.reason}`;
    });
  actions.push({
    kind: "inbox_ranked",
    title: "Inbox analysis",
    detail: `${analysis.summary.critical + analysis.summary.high} need attention · ${analysis.summary.replyNeeded} need a reply`,
    href: "/inbox",
    lines: topLines.length > 0 ? topLines : ordered.slice(0, 5).map((t) => threadLine(t!)),
  });
  return JSON.stringify(analysis);
}

function resolveEmailOutcome(sent: boolean, pending: boolean, mode: string): string {
  if (sent) {
    return mode === "draft" ? "draft_saved" : "email_sent";
  }
  if (pending) {
    return mode === "draft" ? "draft_queued" : "email_queued_for_approval";
  }
  return "email_queue_failed";
}

function resolveEmailActionTitle(sent: boolean, pending: boolean, mode: string): string {
  if (sent) {
    return mode === "draft" ? "Draft saved" : "Email sent";
  }
  if (pending) {
    return mode === "draft" ? "Draft queued" : "Send queued for approval";
  }
  return "Send could not be queued";
}

function resolveEmailTellUser(sent: boolean, pending: boolean, mode: string, to: string): string {
  if (sent) {
    return mode === "draft" ? `Draft saved to Gmail for ${to}.` : `Email sent to ${to} via Gmail.`;
  }
  if (pending) {
    return `Email added to Queue for ${to} — user must approve before it sends.`;
  }
  return `Could not queue email for ${to} — check Queue or try again.`;
}

function resolveEmailActionHref(sent: boolean, threadId?: string): string | undefined {
  if (!sent) return "/queue";
  return threadId ? `/inbox?thread=${encodeURIComponent(threadId)}` : undefined;
}

function resolveEmailDisposition(sent: boolean, pending: boolean): "sent" | "queued" | undefined {
  if (sent) return "sent";
  if (pending) return "queued";
  return undefined;
}

function checkAgentSendCap(mode: string, tenantId: string, to: string, subject: string, sendCounter: { count: number }): string | null {
  if (mode !== "send") return null;
  try {
    enforceEmailSendCap(sendCounter);
    return null;
  } catch (err) {
    logger.warn("agent.send_cap_exceeded", { tenantId, to, subject, count: sendCounter.count });
    return JSON.stringify({ success: false, error: err instanceof ServiceError ? err.message : "Send limit exceeded" });
  }
}

async function touchAgentContact(tenantId: string, to: string): Promise<void> {
  try {
    const contacts = getContactsService();
    await contacts.upsert(tenantId, { email: to, source: "agent" });
    await contacts.touch(tenantId, to);
  } catch { /* best-effort */ }
}

async function executeAgentQueueEmail(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, queue, actions, emailQueueFingerprints, sendCounter } = ctx;
  let validated: { to: string; subject: string; body: string };
  try {
    validated = validateAgentEmailArgs(args);
  } catch (err) {
    return JSON.stringify({ success: false, error: err instanceof ServiceError ? err.message : "Invalid email parameters" });
  }
  const { to, subject, body } = validated;
  const mode = args.mode === "draft" ? "draft" : "send";
  const threadId = typeof args.threadId === "string" ? args.threadId : undefined;
  const cc = typeof args.cc === "string" ? args.cc.trim() : undefined;
  const bcc = typeof args.bcc === "string" ? args.bcc.trim() : undefined;

  const sendCapError = checkAgentSendCap(mode, tenantId, to, subject, sendCounter);
  if (sendCapError) return sendCapError;

  const fingerprint = `${mode}:${to.toLowerCase()}|${subject}|${body}`;
  if (emailQueueFingerprints.has(fingerprint)) {
    return JSON.stringify({ success: true, duplicate: true, message: "This exact email was already queued in this request." });
  }
  emailQueueFingerprints.add(fingerprint);

  const item = await queue.enqueueEmail(
    tenantId,
    { mode, email: { to, subject, body, threadId, cc, bcc }, title: mode === "draft" ? `Draft: ${subject}` : `Send: ${subject}`, preview: body.slice(0, 240) },
    { origin: "agent" },
  );
  logger.info("agent.email_queued", { tenantId, to, subject, mode, queueItemId: item.id, status: item.status });

  await touchAgentContact(tenantId, to);

  const sent = item.status === "approved";
  const pending = item.status === "pending";
  const outcome = resolveEmailOutcome(sent, pending, mode);
  const title = resolveEmailActionTitle(sent, pending, mode);
  const tellUser = resolveEmailTellUser(sent, pending, mode, to);
  const actionHref = resolveEmailActionHref(sent, threadId);
  const disposition = resolveEmailDisposition(sent, pending);

  actions.push({
    kind: "email_queued",
    title,
    detail: `To ${to}`,
    href: actionHref,
    disposition,
    queueItemId: pending ? item.id : undefined,
    threadId: threadId || undefined,
    lines: [`Subject: ${subject}`, body.slice(0, 400)],
  });
  return JSON.stringify({
    success: true,
    queueItemId: item.id,
    status: item.status,
    outcome,
    tellUser,
  });
}

async function executeAgentQueueCalendarInvite(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, queue, actions } = ctx;
  const summary = getString(args.summary).trim();
  const startDateTime = getString(args.startDateTime).trim();
  const endDateTime = getString(args.endDateTime).trim();
  if (!summary || !startDateTime || !endDateTime) {
    return JSON.stringify({ success: false, error: "summary, startDateTime, and endDateTime are required" });
  }
  const item = await queue.enqueueCalendarInvite(
    tenantId,
    {
      calendar: {
        summary, startDateTime, endDateTime,
        description: typeof args.description === "string" ? args.description : undefined,
        location: typeof args.location === "string" ? args.location : undefined,
        timeZone: typeof args.timeZone === "string" ? args.timeZone : undefined,
        attendeeEmails: Array.isArray(args.attendeeEmails) ? args.attendeeEmails.map(String) : undefined,
        recurrence: Array.isArray(args.recurrence) ? args.recurrence.map(String).slice(0, 5) : undefined,
      },
      title: `Invite: ${summary}`,
      preview: `${startDateTime} → ${endDateTime}`,
    },
    { origin: "agent" },
  );
  logger.info("agent.calendar_queued", { tenantId, summary, startDateTime, endDateTime, queueItemId: item.id, status: item.status });
  const sent = item.status === "approved";
  actions.push({
    kind: "calendar_queued",
    title: sent ? "Calendar invite sent" : "Calendar invite queued",
    detail: summary,
    href: sent ? undefined : "/queue",
    disposition: sent ? "sent" : "queued",
    queueItemId: sent ? undefined : item.id,
    lines: [`Start: ${startDateTime}`, `End: ${endDateTime}`],
  });
  return JSON.stringify({
    success: true,
    queueItemId: item.id,
    status: item.status,
    outcome: sent ? "calendar_sent" : "calendar_queued_for_approval",
    tellUser: sent ? `Calendar invite "${summary}" was created on Google Calendar.` : `Calendar invite "${summary}" is in Queue — user must approve before it is created.`,
  });
}

async function executeAgentRescheduleEvent(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, calendar, queue, actions } = ctx;
  const eventId = getString(args.eventId).trim();
  const startDateTime = getString(args.startDateTime).trim();
  const endDateTime = getString(args.endDateTime).trim();
  const timeZone = getString(args.timeZone, "UTC").trim();
  if (!eventId || !startDateTime || !endDateTime) {
    return JSON.stringify({ success: false, error: "eventId, startDateTime, and endDateTime are required" });
  }
  const existing = await calendar.getEvent(tenantId, eventId);
  if (!existing) return JSON.stringify({ success: false, error: "Event not found" });
  const item = await queue.enqueueCalendarArchive(
    tenantId,
    {
      archive: {
        eventId,
        summary: existing.summary ?? "Event",
        startDateTime,
        endDateTime,
        timeZone,
        htmlLink: existing.htmlLink,
        recurringEventId: existing.recurringEventId,
      },
      title: `Reschedule: ${existing.summary ?? "Event"}`,
    },
    { origin: "agent" },
  );
  actions.push({
    kind: "calendar_queued",
    title: "Reschedule queued",
    detail: existing.summary ?? eventId,
    href: "/queue",
    queueItemId: item.id,
    disposition: item.status === "approved" ? "sent" : "queued",
  });
  return JSON.stringify({ success: true, queued: true, queueItemId: item.id, status: item.status });
}

async function executeAgentCancelEvent(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, calendar, queue, actions } = ctx;
  const eventId = getString(args.eventId).trim();
  if (!eventId) return JSON.stringify({ success: false, error: "eventId is required" });
  const existing = await calendar.getEvent(tenantId, eventId);
  const item = await queue.enqueueCalendarDelete(
    tenantId,
    {
      delete: {
        eventId,
        summary: existing?.summary ?? "Event",
        htmlLink: existing?.htmlLink,
        recurringEventId: existing?.recurringEventId,
        cancelWithNotify: true,
      },
      title: `Cancel: ${existing?.summary ?? eventId}`,
    },
    { origin: "agent" },
  );
  actions.push({
    kind: "calendar_queued",
    title: "Cancel queued",
    detail: existing?.summary ?? eventId,
    href: "/queue",
    queueItemId: item.id,
    disposition: item.status === "approved" ? "sent" : "queued",
  });
  return JSON.stringify({ success: true, queued: true, queueItemId: item.id, status: item.status });
}

async function executeAgentUpdateEventDetails(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, calendar, queue, actions } = ctx;
  const eventId = getString(args.eventId).trim();
  if (!eventId) return JSON.stringify({ success: false, error: "eventId is required" });
  const newSummary = typeof args.summary === "string" ? args.summary.trim() : undefined;
  const description = typeof args.description === "string" ? args.description : undefined;
  const location = typeof args.location === "string" ? args.location : undefined;
  if (!newSummary && !description && !location) {
    return JSON.stringify({ success: false, error: "At least one of summary, description, or location is required" });
  }
  const existing = await calendar.getEvent(tenantId, eventId);
  if (!existing) return JSON.stringify({ success: false, error: "Event not found" });
  const item = await queue.enqueueCalendarUpdate(
    tenantId,
    {
      update: {
        eventId,
        summary: existing.summary ?? "Event",
        newSummary,
        description,
        location,
        htmlLink: existing.htmlLink,
      },
      title: `Update: ${existing.summary ?? "Event"}`,
    },
    { origin: "agent" },
  );
  const disposition = item.status === "approved" ? "updated" : "queued";
  actions.push({
    kind: "calendar",
    title: disposition === "updated" ? "Event updated" : "Event update queued",
    detail: newSummary ?? existing.summary ?? eventId,
    href: disposition === "updated" ? "/calendar" : "/queue",
  });
  return JSON.stringify({ success: true, queued: item.status !== "approved", queueItemId: item.id, status: item.status });
}

async function executeAgentListOrSearchInbox(args: Record<string, unknown>, ctx: AgentExecutorContext, isSearch: boolean): Promise<string> {
  const { tenantId, inbox, actions } = ctx;
  const maxLimit = isSearch ? 25 : 50;
  const defaultCount = isSearch ? 10 : 20;
  const maxResults = Math.min(Math.max(Number(args.maxResults) || defaultCount, 1), maxLimit);
  const query = typeof args.query === "string" ? args.query.trim() : undefined;
  const result = await inbox.listThreads(tenantId, { maxResults, query });
  const lines = result.threads.map((t) => threadLine(t));
  const searchTitle = query ? `Search: ${query}` : "Recent inbox";
  const listTitle = query ? `Inbox: ${query}` : "Recent inbox";
  actions.push({
    kind: "inbox_search",
    title: isSearch ? searchTitle : listTitle,
    detail: `${result.threads.length} thread(s)`,
    href: isSearch && query ? `/inbox?focus=search` : "/inbox",
    lines: lines.slice(0, 8),
  });
  return JSON.stringify({
    threads: result.threads.map((t) => ({ ...t, snippet: fenceEmailData(t.snippet) })),
    count: result.threads.length,
  });
}

async function executeAgentGetThread(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, userEmail, inbox, actions } = ctx;
  const threadId = getString(args.threadId);
  const thread = await inbox.getThread(tenantId, threadId, { userEmail });
  if (!thread) return JSON.stringify({ error: "Thread not found" });
  const fencedMessages = (thread.messages ?? []).slice(0, 5).map((m) => ({
    from: m.from ?? "?",
    body: fenceEmailData(m.body.slice(0, 2000)),
  }));
  actions.push({
    kind: "thread",
    title: thread.subject?.trim() || "Thread",
    detail: thread.fromName || thread.from,
    href: `/inbox?thread=${encodeURIComponent(threadId)}`,
    lines: (thread.messages ?? []).slice(0, 5).map((m) => `${m.from ?? "?"}: ${m.body.slice(0, 200)}`),
  });
  return JSON.stringify({ thread: { ...thread, messages: fencedMessages } });
}

async function executeInboxReadTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const { tenantId, inbox } = ctx;
  switch (name) {
    case "list_inbox":
      return executeAgentListOrSearchInbox(args, ctx, false);
    case "search_inbox":
      return executeAgentListOrSearchInbox(args, ctx, true);
    case "get_thread":
      return executeAgentGetThread(args, ctx);
    case "rank_inbox":
      return executeAgentRankInbox(args, ctx);
    case "get_gmail_connection_status": {
      const status = await inbox.getConnectionStatus(tenantId);
      return JSON.stringify({ status: status.gmail, connected: status.gmail === "connected" });
    }
    case "list_labels": {
      const labels = await inbox.listLabels(tenantId);
      return JSON.stringify({ labels });
    }
    case "list_messages": {
      const result = await inbox.listMessages(tenantId, {
        maxResults: args.maxResults != null ? Number(args.maxResults) : undefined,
        q: typeof args.q === "string" ? args.q : undefined,
        labelIds: Array.isArray(args.labelIds) ? args.labelIds.map(String) : undefined,
      });
      return JSON.stringify(result);
    }
    default:
      return null;
  }
}

async function executeQueueManagementTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const { tenantId, queue, actions } = ctx;
  switch (name) {
    case "list_queue": {
      const status = args.status === "all" ? "all" : "pending";
      const items = await queue.listItems(tenantId, { status });
      actions.push({
        kind: "queue_list",
        title: status === "pending" ? "Pending queue" : "All queue items",
        detail: `${items.length} item(s)`,
        href: "/queue",
        lines: items.slice(0, 10).map((i) => `${i.kind}: ${i.title}`),
      });
      return JSON.stringify({ items });
    }
    case "approve_queue_item": {
      const itemId = getString(args.itemId).trim();
      if (!itemId) return JSON.stringify({ success: false, error: "itemId is required" });
      const result = await queue.approve(tenantId, itemId);
      actions.push({ kind: "queue_list", title: "Queue item approved", detail: result.title, href: "/queue", lines: [`${result.kind}: ${result.title}`] });
      return JSON.stringify({ success: true, itemId, status: result.status });
    }
    case "dismiss_queue_item": {
      const itemId = getString(args.itemId).trim();
      if (!itemId) return JSON.stringify({ success: false, error: "itemId is required" });
      await queue.dismiss(tenantId, itemId);
      actions.push({ kind: "queue_list", title: "Queue item dismissed", detail: itemId, href: "/queue" });
      return JSON.stringify({ success: true, itemId });
    }
    default:
      return null;
  }
}

async function executeQueueEnqueueTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const { tenantId, queue, actions } = ctx;
  switch (name) {
    case "queue_email":
      return executeAgentQueueEmail(args, ctx);
    case "queue_calendar_invite":
      return executeAgentQueueCalendarInvite(args, ctx);
    case "reschedule_event":
      return executeAgentRescheduleEvent(args, ctx);
    case "cancel_event":
      return executeAgentCancelEvent(args, ctx);
    case "update_event_details":
      return executeAgentUpdateEventDetails(args, ctx);
    case "quick_add_event": {
      const text = getString(args.text).trim();
      if (!text) return JSON.stringify({ success: false, error: "text is required" });
      const item = await queue.enqueueQuickAddCalendar(tenantId, { text }, { origin: "agent" });
      const disposition = item.status === "approved" ? "sent" : "queued";
      actions.push({
        kind: "calendar_queued",
        title: item.title,
        detail: text,
        href: "/queue",
        disposition,
        queueItemId: item.id,
      });
      return JSON.stringify({ success: true, queued: disposition === "queued", itemId: item.id });
    }
    case "send_draft": {
      const draftId = getString(args.draftId).trim();
      if (!draftId) return JSON.stringify({ success: false, error: "draftId is required" });
      const item = await queue.enqueueDraftSend(tenantId, { draftId }, { origin: "agent" });
      const disposition = item.status === "approved" ? "sent" : "queued";
      actions.push({
        kind: "email_queued",
        title: item.title,
        detail: `Draft ${draftId}`,
        href: "/queue",
        disposition,
        queueItemId: item.id,
      });
      return JSON.stringify({ success: true, queued: disposition === "queued", itemId: item.id });
    }
    default:
      return null;
  }
}

async function executeQueueActionTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const mgmtResult = await executeQueueManagementTools(name, args, ctx);
  if (mgmtResult !== null) return mgmtResult;
  return executeQueueEnqueueTools(name, args, ctx);
}

async function executeAgentCreateDraft(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, inbox, actions } = ctx;
  const to = getString(args.to).trim();
  const subject = getString(args.subject).trim();
  const body = getString(args.body).trim();
  if (!to || !subject || !body) return JSON.stringify({ success: false, error: "to, subject, and body are required" });
  const draft = await inbox.createDraft(tenantId, {
    to,
    subject,
    body,
    threadId: typeof args.threadId === "string" ? args.threadId : undefined,
    cc: typeof args.cc === "string" ? args.cc : undefined,
    bcc: typeof args.bcc === "string" ? args.bcc : undefined,
  });
  actions.push({ kind: "thread", title: "Draft saved", detail: subject, href: "/inbox" });
  return JSON.stringify({ success: true, draftId: draft.id, subject, to });
}

async function executeAgentUpdateDraft(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, inbox } = ctx;
  const draftId = getString(args.draftId).trim();
  const to = getString(args.to).trim();
  const subject = getString(args.subject).trim();
  const body = getString(args.body);
  if (!draftId || !to || !subject) {
    return JSON.stringify({ success: false, error: "draftId, to, and subject are required" });
  }
  const result = await inbox.updateDraft(tenantId, draftId, {
    to, subject, body,
    threadId: typeof args.threadId === "string" ? args.threadId : undefined,
  });
  return JSON.stringify({ success: true, ...result });
}

async function executeDraftActionTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const { tenantId, inbox, actions } = ctx;
  switch (name) {
    case "list_drafts": {
      const maxResults = Math.min(25, Math.max(1, Number(args.maxResults ?? 10)));
      const result = await inbox.listDrafts(tenantId, { maxResults });
      actions.push({ kind: "thread", title: `${result.drafts?.length ?? 0} drafts found`, href: "/inbox?view=drafts" });
      return JSON.stringify(result);
    }
    case "get_draft": {
      const draftId = getString(args.draftId).trim();
      if (!draftId) return JSON.stringify({ success: false, error: "draftId is required" });
      const draft = await inbox.getDraft(tenantId, draftId);
      if (!draft) return JSON.stringify({ success: false, error: "Draft not found" });
      return JSON.stringify({ success: true, draft: { ...draft, body: fenceEmailData(draft.body) } });
    }
    case "delete_draft": {
      const draftId = getString(args.draftId).trim();
      if (!draftId) return JSON.stringify({ success: false, error: "draftId is required" });
      await inbox.deleteDraft(tenantId, draftId);
      actions.push({ kind: "thread", title: "Draft deleted", detail: draftId, href: "/inbox?view=drafts" });
      return JSON.stringify({ success: true, draftId, action: "deleted" });
    }
    case "create_draft_email":
      return executeAgentCreateDraft(args, ctx);
    case "update_draft":
      return executeAgentUpdateDraft(args, ctx);
    default:
      return null;
  }
}

async function executeQueueAndDraftTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const queueResult = await executeQueueActionTools(name, args, ctx);
  if (queueResult !== null) return queueResult;
  return executeDraftActionTools(name, args, ctx);
}

async function executeThreadTriageTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const TRIAGE_ACTIONS = new Set([
    "archive_thread", "star_thread", "unstar_thread", "mark_important",
    "mark_not_important", "trash_thread", "untrash_thread", "delete_thread",
    "mark_thread_read", "mark_thread_unread", "mute_thread", "unmute_thread",
  ]);
  if (!TRIAGE_ACTIONS.has(name)) return null;
  const threadId = getString(args.threadId).trim();
  if (!threadId) return JSON.stringify({ success: false, error: "threadId is required" });

  const { tenantId, inbox, actions } = ctx;
  switch (name) {
    case "archive_thread":
      await inbox.archiveThread(tenantId, threadId);
      actions.push({ kind: "thread", title: "Thread archived", detail: threadId, href: "/inbox" });
      return JSON.stringify({ success: true, threadId });
    case "star_thread":
      await inbox.starThread(tenantId, threadId);
      actions.push({ kind: "thread", title: "Thread starred", detail: threadId, href: `/inbox?thread=${encodeURIComponent(threadId)}` });
      return JSON.stringify({ success: true, threadId, action: "starred" });
    case "unstar_thread":
      await inbox.unstarThread(tenantId, threadId);
      actions.push({ kind: "thread", title: "Thread unstarred", detail: threadId, href: `/inbox?thread=${encodeURIComponent(threadId)}` });
      return JSON.stringify({ success: true, threadId, action: "unstarred" });
    case "mark_important":
      await inbox.markImportant(tenantId, threadId);
      actions.push({ kind: "thread", title: "Marked important", detail: threadId, href: `/inbox?thread=${encodeURIComponent(threadId)}` });
      return JSON.stringify({ success: true, threadId, action: "marked_important" });
    case "mark_not_important":
      await inbox.markNotImportant(tenantId, threadId);
      actions.push({ kind: "thread", title: "Marked not important", detail: threadId, href: "/inbox" });
      return JSON.stringify({ success: true, threadId, action: "marked_not_important" });
    case "trash_thread":
      await inbox.trashThread(tenantId, threadId);
      actions.push({ kind: "thread", title: "Thread moved to trash", detail: threadId, href: "/inbox" });
      return JSON.stringify({ success: true, threadId, action: "trashed" });
    case "untrash_thread":
      await inbox.untrashThread(tenantId, threadId);
      return JSON.stringify({ success: true, threadId, untrashed: true });
    case "delete_thread":
      await inbox.deleteThread(tenantId, threadId);
      return JSON.stringify({ success: true, threadId, deleted: true });
    case "mark_thread_read":
      await inbox.markThreadRead(tenantId, threadId);
      return JSON.stringify({ success: true, threadId, action: "marked_read" });
    case "mark_thread_unread":
      await inbox.markThreadUnread(tenantId, threadId);
      return JSON.stringify({ success: true, threadId, action: "marked_unread" });
    case "mute_thread":
      await inbox.muteThread(tenantId, threadId);
      return JSON.stringify({ success: true, threadId, muted: true });
    case "unmute_thread":
      await inbox.unmuteThread(tenantId, threadId);
      return JSON.stringify({ success: true, threadId, muted: false });
    default:
      return null;
  }
}

async function executeAgentApplyOrRemoveLabel(
  isApply: boolean,
  args: Record<string, unknown>,
  ctx: AgentExecutorContext,
): Promise<string> {
  const { tenantId, inbox, actions } = ctx;
  const threadId = getString(args.threadId).trim();
  const labelId = getString(args.labelId).trim();
  if (!threadId || !labelId) return JSON.stringify({ success: false, error: "threadId and labelId are required" });
  if (isApply) {
    await inbox.applyLabel(tenantId, threadId, labelId);
    actions.push({ kind: "thread", title: "Label applied", detail: `${labelId} on ${threadId}`, href: "/inbox" });
  } else {
    await inbox.removeLabel(tenantId, threadId, labelId);
    actions.push({ kind: "thread", title: "Label removed", detail: `${labelId} from ${threadId}`, href: "/inbox" });
  }
  return JSON.stringify({ success: true, threadId, labelId });
}

async function executeAgentBatchModifyThreads(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, inbox } = ctx;
  const threadIds = Array.isArray(args.threadIds) ? args.threadIds.map(String) : [];
  if (threadIds.length === 0) return JSON.stringify({ success: false, error: "threadIds is required" });
  const result = await inbox.batchModifyThreads(tenantId, {
    threadIds,
    addLabelIds: Array.isArray(args.addLabelIds) ? args.addLabelIds.map(String) : undefined,
    removeLabelIds: Array.isArray(args.removeLabelIds) ? args.removeLabelIds.map(String) : undefined,
  });
  return JSON.stringify({ success: true, ...result });
}

async function executeAgentModifyMessage(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, inbox } = ctx;
  const messageId = getString(args.messageId).trim();
  if (!messageId) return JSON.stringify({ success: false, error: "messageId is required" });
  await inbox.modifyMessage(tenantId, messageId, {
    addLabelIds: Array.isArray(args.addLabelIds) ? args.addLabelIds.map(String) : undefined,
    removeLabelIds: Array.isArray(args.removeLabelIds) ? args.removeLabelIds.map(String) : undefined,
  });
  return JSON.stringify({ success: true, messageId });
}

async function executeLabelAndBatchTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  switch (name) {
    case "apply_label":
      return executeAgentApplyOrRemoveLabel(true, args, ctx);
    case "remove_label":
      return executeAgentApplyOrRemoveLabel(false, args, ctx);
    case "batch_modify_threads":
      return executeAgentBatchModifyThreads(args, ctx);
    case "modify_message":
      return executeAgentModifyMessage(args, ctx);
    default:
      return null;
  }
}

async function executeEmailWriteTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const triageResult = await executeThreadTriageTools(name, args, ctx);
  if (triageResult !== null) return triageResult;
  return executeLabelAndBatchTools(name, args, ctx);
}

async function executeCalendarTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const { tenantId, calendar, actions } = ctx;
  switch (name) {
    case "list_calendar_events": {
      const query = typeof args.query === "string" ? args.query.trim() : undefined;
      const now = new Date();
      const timeMin =
        getString(args.timeMin).trim() ||
        new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const timeMax =
        getString(args.timeMax).trim() ||
        new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
      const maxResults = Math.min(Math.max(Number(args.maxResults) || 20, 1), 50);
      const result = await calendar.listEvents(tenantId, {
        timeMin,
        timeMax,
        maxResults,
        ...(query ? { q: query } : {}),
      });
      return JSON.stringify({ events: result.events, count: result.events.length, query: query ?? null });
    }
    case "check_free_busy": {
      const startDateTime = getString(args.startDateTime).trim();
      const endDateTime = getString(args.endDateTime).trim();
      const timeZone = getString(args.timeZone, "UTC").trim();
      if (!startDateTime || !endDateTime) return JSON.stringify({ success: false, error: "startDateTime and endDateTime are required" });
      const result = await calendar.checkFreeBusy(tenantId, { startDateTime, endDateTime, timeZone });
      return JSON.stringify(result);
    }
    case "respond_to_event": {
      const eventId = getString(args.eventId).trim();
      const responseRaw = getString(args.response).trim().toLowerCase();
      const response = responseRaw as "accepted" | "declined" | "tentative";
      if (!eventId || !["accepted", "declined", "tentative"].includes(response)) {
        return JSON.stringify({ success: false, error: "eventId and response (accepted/declined/tentative) are required" });
      }
      const updated = await calendar.respondToEvent(tenantId, eventId, response);
      actions.push({ kind: "calendar", title: `Event ${response}`, detail: updated.summary, href: "/calendar" });
      return JSON.stringify({ success: true, eventId, response, event: updated });
    }
    case "get_calendar_event": {
      const eventId = getString(args.eventId).trim();
      if (!eventId) return JSON.stringify({ success: false, error: "eventId is required" });
      const event = await calendar.getEvent(tenantId, eventId);
      if (!event) return JSON.stringify({ success: false, error: "Event not found" });
      return JSON.stringify(event);
    }
    case "get_calendar_connection_status": {
      const calStatus = await calendar.getConnectionStatus(tenantId);
      return JSON.stringify({ connected: calStatus.googlecalendar === "connected", status: calStatus });
    }
    default:
      return null;
  }
}

async function executeAgentContactIntel(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, userEmail, actions } = ctx;
  const email = getString(args.email).trim();
  const contactName = typeof args.name === "string" ? args.name.trim() : undefined;
  if (!email) return JSON.stringify({ success: false, error: "email is required" });
  const intel = await getContactIntel({ tenantId, email, name: contactName, userEmail });
  const searchHref = "/inbox?q=" + encodeURIComponent("from:" + email);
  actions.push({ kind: "thread", title: `Relationship: ${intel.name ?? email}`, detail: intel.relationshipSummary, href: searchHref });
  return JSON.stringify(intel);
}

async function executeAgentFindMeetingSlots(args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string> {
  const { tenantId, actions } = ctx;
  const durationMinutes = Math.max(15, Math.min(480, Number(args.durationMinutes ?? 30)));
  const { findMeetingSlots } = await import("./meeting-slots");
  const result = await findMeetingSlots({
    tenantId,
    durationMinutes,
    preferredStartDate: typeof args.preferredStartDate === "string" ? args.preferredStartDate : undefined,
    preferredEndDate: typeof args.preferredEndDate === "string" ? args.preferredEndDate : undefined,
    timeZone: typeof args.timeZone === "string" ? args.timeZone : undefined,
    attendeeEmail: typeof args.attendeeEmail === "string" ? args.attendeeEmail : undefined,
    context: typeof args.context === "string" ? args.context : undefined,
  });
  if (result.slots.length > 0) {
    actions.push({ kind: "calendar", title: `${result.slots.length} meeting slots found`, detail: result.slots[0]!.label, href: "/calendar" });
  }
  return JSON.stringify(result);
}

async function executeAiAndIntelTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const { tenantId, userEmail, actions } = ctx;
  switch (name) {
    case "get_daily_brief": {
      const timeZone = getString(args.timeZone, "UTC").trim();
      const brief = await generateDailyBrief({ tenantId, userEmail, timeZone });
      actions.push({ kind: "thread", title: "Daily Brief", detail: "View your daily brief", href: "/brief" });
      return JSON.stringify(brief);
    }
    case "get_smart_replies": {
      const threadId = getString(args.threadId).trim();
      if (!threadId) return JSON.stringify({ success: false, error: "threadId is required" });
      const result = await getSmartReplies({ tenantId, threadId, userEmail });
      actions.push({ kind: "thread", title: "Smart replies ready", detail: `${result.suggestions.length} suggestions`, href: `/inbox?thread=${encodeURIComponent(threadId)}` });
      return JSON.stringify(result);
    }
    case "get_meeting_prep": {
      const eventId = getString(args.eventId).trim();
      const timeZone = getString(args.timeZone, "UTC").trim();
      if (!eventId) return JSON.stringify({ success: false, error: "eventId is required" });
      const prep = await getMeetingPrep({ tenantId, eventId, timeZone });
      actions.push({ kind: "calendar", title: "Meeting prep ready", detail: prep.summary ?? eventId, href: `/calendar?event=${encodeURIComponent(eventId)}` });
      return JSON.stringify(prep);
    }
    case "get_thread_context": {
      const threadId = getString(args.threadId).trim();
      if (!threadId) return JSON.stringify({ success: false, error: "threadId is required" });
      const ctx2 = await getThreadContext({ tenantId, threadId, userEmail });
      actions.push({ kind: "thread", title: "Thread context", detail: ctx2.nextAction ?? threadId, href: `/inbox?thread=${encodeURIComponent(threadId)}` });
      return JSON.stringify(ctx2);
    }
    case "get_missed_followups": {
      const timeZone = getString(args.timeZone, "UTC").trim();
      const followups = await getMissedFollowUps({ tenantId, userEmail, timeZone });
      actions.push({ kind: "thread", title: `${followups.length} missed follow-ups`, detail: "Meetings with no follow-up email", href: "/brief" });
      return JSON.stringify({ followups, count: followups.length });
    }
    case "get_contact_intel":
      return executeAgentContactIntel(args, ctx);
    case "summarize_thread": {
      const threadId = getString(args.threadId).trim();
      if (!threadId) return JSON.stringify({ success: false, error: "threadId is required" });
      const summary = await summarizeThread({ tenantId, threadId, userEmail });
      actions.push({ kind: "thread", title: "Thread summarized", detail: summary.subject, href: `/inbox?thread=${encodeURIComponent(threadId)}` });
      return JSON.stringify(summary);
    }
    case "find_meeting_slots":
      return executeAgentFindMeetingSlots(args, ctx);
    default:
      return null;
  }
}

function parseAgentDbSearchArgs(args: Record<string, unknown>) {
  return {
    query: typeof args.query === "string" ? args.query : undefined,
    limit: args.limit != null ? Number(args.limit) : undefined,
  };
}

async function executeDbSearchTools(name: string, args: Record<string, unknown>, ctx: AgentExecutorContext): Promise<string | null> {
  const { tenantId, inbox, calendar } = ctx;
  const pagination = parseAgentDbSearchArgs(args);
  switch (name) {
    case "search_threads_db":
      return JSON.stringify(await inbox.searchThreadsDb(tenantId, pagination));
    case "search_messages_db":
      return JSON.stringify(await inbox.searchMessagesDb(tenantId, {
        ...pagination,
        from: typeof args.from === "string" ? args.from : undefined,
      }));
    case "search_events_db":
      return JSON.stringify(await calendar.searchEventsDb(tenantId, pagination));
    case "search_calendars_db":
      return JSON.stringify(await calendar.searchCalendarsDb(tenantId, pagination));
    case "search_drafts_db":
      return JSON.stringify(await inbox.searchDraftsDb(tenantId, { limit: pagination.limit }));
    case "search_labels_db":
      return JSON.stringify(await inbox.searchLabelsDb(tenantId, {
        limit: pagination.limit,
        name: typeof args.name === "string" ? args.name : undefined,
      }));
    default:
      return null;
  }
}

export function buildToolExecutor(ctx: AgentExecutorContext) {
  return async (name: string, args: Record<string, unknown>): Promise<string> => {
    const resInbox = await executeInboxReadTools(name, args, ctx);
    if (resInbox !== null) return resInbox;

    const resQueue = await executeQueueAndDraftTools(name, args, ctx);
    if (resQueue !== null) return resQueue;

    const resEmail = await executeEmailWriteTools(name, args, ctx);
    if (resEmail !== null) return resEmail;

    const resCal = await executeCalendarTools(name, args, ctx);
    if (resCal !== null) return resCal;

    const resAi = await executeAiAndIntelTools(name, args, ctx);
    if (resAi !== null) return resAi;

    const resDb = await executeDbSearchTools(name, args, ctx);
    if (resDb !== null) return resDb;

    return JSON.stringify({ error: `Unknown tool: ${name}` });
  };
}
