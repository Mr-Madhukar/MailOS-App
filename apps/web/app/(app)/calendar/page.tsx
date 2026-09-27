"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar as CalIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  ListChecks,
  Loader2,
  Plus,
  Repeat,
  Sparkles,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { trpc } from "~/trpc/client";
import { parseQuickAddText } from "~/lib/parse-quick-add-client";
import {
  demoEventMatchesDelete,
  isQuickDeleteIntent,
  parseQuickDeleteText,
} from "~/lib/parse-quick-delete-client";
import { useDemoAiGuard } from "~/components/app/demo-limit-modal";
import type { RouterOutputs } from "@repo/trpc/client";
import { SkeletonList } from "~/components/app/skeleton-list";
import { QueryErrorState } from "~/components/app/query-error-state";
import { MeetingPrepPanel } from "~/components/app/meeting-prep-panel";
import { queueResultMessage } from "~/lib/queue-toast";
import {
  eventDayKey,
  eventToArchivePayload,
  eventToDeletePayload,
  isoToLocalDateTimeInput,
  localDateTimeRangeToPayload,
  localDayKey,
  type RecurringEditScope,
  toLocalDateTimeInput,
} from "~/lib/calendar-datetime";
import {
  type CalendarViewMode,
  getVisibleDays,
  navigateAnchor,
  prevNextAriaLabel,
  queryBoundsForView,
  viewPeriodLabel,
} from "~/lib/calendar-view";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_EVENT_CAP = 3;

const VIEW_MODE_LABELS: Record<CalendarViewMode, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

const EMPTY_PERIOD_NOTES: Record<CalendarViewMode, string> = {
  day: "No events today",
  week: "No events this week",
  month: "No events this month",
};

const RECURRING_SCOPE_DESCRIPTIONS: Record<string, string> = {
  series: "Reschedule or delete will update the entire recurring series on Google Calendar.",
  following: "This occurrence and all future occurrences in the series will change.",
  instance: "Only this occurrence changes — other events in the series stay the same.",
};

const RECURRING_DELETE_DESCRIPTIONS: Record<string, string> = {
  series: "Approving removes the entire recurring series.",
  following: "Approving removes this and all future occurrences.",
  instance: "Approving removes only this occurrence.",
};

type RsvpResponseStatus = "accepted" | "tentative" | "declined";

const RSVP_STATUS_LABELS: Record<RsvpResponseStatus, string> = {
  accepted: "Accepted",
  declined: "Declined",
  tentative: "Maybe",
};

const RSVP_OPTIONS: Array<{
  resp: RsvpResponseStatus;
  label: string;
  icon: typeof Check;
}> = [
  { resp: "accepted", label: "Accept", icon: Check },
  { resp: "tentative", label: "Maybe", icon: HelpCircle },
  { resp: "declined", label: "Decline", icon: XCircle },
];

type CalendarEventItem = {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  htmlLink?: string;
  status?: string;
  isRecurring?: boolean;
  recurringEventId?: string;
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string; organizer?: boolean }>;
  pending?: boolean;
  pendingArchive?: boolean;
  pendingDelete?: boolean;
};

type QueueListItem = RouterOutputs["queue"]["list"]["items"][number];

/** Rich client-side demo events — no DB, no API. */
function makeDemoEvents(): CalendarEventItem[] {
  const today = new Date();
  today.setSeconds(0, 0);

  const ev1Start = new Date(today);
  ev1Start.setHours(10, 0, 0, 0);
  const ev1End = new Date(ev1Start);
  ev1End.setHours(10, 30, 0, 0);

  const ev2Start = new Date(today);
  ev2Start.setHours(11, 0, 0, 0);
  const ev2End = new Date(ev2Start);
  ev2End.setHours(12, 0, 0, 0);

  const ev3Start = new Date(today);
  ev3Start.setHours(15, 0, 0, 0);
  const ev3End = new Date(ev3Start);
  ev3End.setHours(16, 0, 0, 0);

  const ev4Start = new Date(today);
  ev4Start.setDate(today.getDate() + 1);
  ev4Start.setHours(14, 0, 0, 0);
  const ev4End = new Date(ev4Start);
  ev4End.setMinutes(30);

  const ev5Start = new Date(today);
  ev5Start.setDate(today.getDate() + 1);
  ev5Start.setHours(16, 0, 0, 0);
  const ev5End = new Date(ev5Start);
  ev5End.setHours(17, 0, 0, 0);

  return [
    {
      id: "demo-cal-1",
      summary: "Daily Brief standup",
      start: ev1Start.toISOString(),
      end: ev1End.toISOString(),
      location: "Virtual · meet.google.com/thread-demo",
      attendees: [
        { email: "demo@mailos.dev", displayName: "You", responseStatus: "accepted", organizer: true },
      ],
    },
    {
      id: "demo-cal-2",
      summary: "Corsair Hackathon Demo",
      start: ev2Start.toISOString(),
      end: ev2End.toISOString(),
      location: "Virtual · meet.google.com/demo",
      attendees: [
        { email: "judge@corsair.dev", displayName: "Judge", responseStatus: "accepted" },
        { email: "demo@mailos.dev", displayName: "Thread Demo", responseStatus: "accepted", organizer: true },
      ],
    },
    {
      id: "demo-cal-3",
      summary: "Focus block — deep work",
      start: ev3Start.toISOString(),
      end: ev3End.toISOString(),
      attendees: [],
    },
    {
      id: "demo-cal-4",
      summary: "Team sync — product review",
      start: ev4Start.toISOString(),
      end: ev4End.toISOString(),
      attendees: [
        { email: "team@example.com", displayName: "Team", responseStatus: "needsAction" },
      ],
    },
    {
      id: "demo-cal-5",
      summary: "Investor update prep",
      start: ev5Start.toISOString(),
      end: ev5End.toISOString(),
      location: "Conference room B",
      attendees: [
        { email: "founder@startup.io", displayName: "Alex", responseStatus: "accepted" },
      ],
    },
  ];
}

function recurrenceToRrule(rule: string, custom?: string): string[] | undefined {
  if (rule === "custom") {
    const trimmed = custom?.trim();
    if (!trimmed) return undefined;
    return [trimmed.startsWith("RRULE:") ? trimmed : `RRULE:${trimmed}`];
  }
  switch (rule) {
    case "daily":
      return ["RRULE:FREQ=DAILY"];
    case "weekly":
      return ["RRULE:FREQ=WEEKLY"];
    case "monthly":
      return ["RRULE:FREQ=MONTHLY"];
    default:
      return undefined;
  }
}

function formatEventTime(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "All day";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatEventWhen(start?: string, end?: string) {
  if (!start) return "";
  const startLabel = formatEventTime(start);
  const endLabel = end ? formatEventTime(end) : "";
  if (start.length === 10) return "All day";
  const day = new Date(start).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return endLabel ? `${day} · ${startLabel} – ${endLabel}` : `${day} · ${startLabel}`;
}

function readQueuedCalendar(payload: Record<string, unknown>) {
  const calendar = (typeof payload.calendar === "object" && payload.calendar !== null ? payload.calendar : undefined) as Record<string, unknown> | undefined;
  const start = (typeof calendar?.startDateTime === "string" ? calendar.startDateTime : undefined)
    ?? (typeof payload.startDateTime === "string" ? payload.startDateTime : undefined);
  const end = (typeof calendar?.endDateTime === "string" ? calendar.endDateTime : undefined)
    ?? (typeof payload.endDateTime === "string" ? payload.endDateTime : undefined);
  const summaryVal = calendar?.summary ?? payload.summary;
  const summary = typeof summaryVal === "string" ? summaryVal : "Meeting";

  if (start && end) {
    return { summary, startDateTime: start, endDateTime: end };
  }
  return null;
}

function getEventIdFromPayload(payload: unknown): string | null {
  if (typeof payload === "object" && payload !== null && "eventId" in payload) {
    const id = (payload as { eventId?: unknown }).eventId;
    return typeof id === "string" ? id : null;
  }
  return null;
}

function resolveQueueItemForEvent(event: CalendarEventItem, items: QueueListItem[]): QueueListItem | null {
  const active = items.filter((item) => item.status === "pending" || item.status === "processing");

  if (event.pending && event.id.startsWith("queue-")) {
    const queueItemId = event.id.slice("queue-".length);
    return active.find((item) => item.id === queueItemId) ?? null;
  }

  if (event.pendingDelete) {
    return (
      active.find((item) => {
        if (item.kind !== "calendar_delete") return false;
        return getEventIdFromPayload(item.payload) === event.id;
      }) ?? null
    );
  }

  if (event.pendingArchive) {
    return (
      active.find((item) => {
        if (item.kind !== "calendar_archive") return false;
        return getEventIdFromPayload(item.payload) === event.id;
      }) ?? null
    );
  }

  return null;
}

function getEventPrefix(event: CalendarEventItem): string {
  if (event.pendingArchive) return "Review · ";
  if (event.pendingDelete) return "Delete · ";
  if (event.pending) return "Queued · ";
  return "";
}

function mergeQueueArchive(map: Map<string, CalendarEventItem[]>, item: QueueListItem) {
  const payload = item.payload;
  const eventId = getEventIdFromPayload(payload) ?? "";
  const summaryVal = typeof payload === "object" && payload !== null && "summary" in payload
    ? (payload as { summary?: unknown }).summary
    : undefined;
  const summary = typeof summaryVal === "string" ? summaryVal : item.title.replace(/^Reschedule:\s*/i, "");
  const startVal = typeof payload === "object" && payload !== null && "startDateTime" in payload
    ? (payload as { startDateTime?: unknown }).startDateTime
    : undefined;
  const start = typeof startVal === "string" ? startVal : "";
  const endVal = typeof payload === "object" && payload !== null && "endDateTime" in payload
    ? (payload as { endDateTime?: unknown }).endDateTime
    : undefined;
  const end = typeof endVal === "string" ? endVal : "";
  const key = eventDayKey(start);
  if (!key || !map.has(key)) return;
  const dayEvents = map.get(key)!;
  const existing = dayEvents.find((entry) => entry.id === eventId);
  if (existing) {
    existing.pendingArchive = true;
  } else {
    dayEvents.push({
      id: eventId || `queue-archive-${item.id}`,
      summary,
      start,
      end,
      pendingArchive: true,
    });
  }
}

function mergeQueueDelete(map: Map<string, CalendarEventItem[]>, item: QueueListItem) {
  const eventId = getEventIdFromPayload(item.payload) ?? "";
  if (!eventId) return;
  for (const [, dayEvents] of map) {
    const existing = dayEvents.find((entry) => entry.id === eventId);
    if (existing) {
      existing.pendingDelete = true;
    }
  }
}

function mergeQueueInvite(map: Map<string, CalendarEventItem[]>, item: QueueListItem) {
  const queued = typeof item.payload === "object" && item.payload !== null
    ? readQueuedCalendar(item.payload as Record<string, unknown>)
    : null;
  if (!queued) return;
  const key = eventDayKey(queued.startDateTime);
  if (!key || !map.has(key)) return;
  map.get(key)!.push({
    id: `queue-${item.id}`,
    summary: queued.summary,
    start: queued.startDateTime,
    end: queued.endDateTime,
    pending: true,
  });
}

function applyQueueItemToCalendarMap(map: Map<string, CalendarEventItem[]>, item: QueueListItem) {
  if (item.kind === "calendar_archive") {
    mergeQueueArchive(map, item);
  } else if (item.kind === "calendar_delete") {
    mergeQueueDelete(map, item);
  } else if (item.kind === "calendar_invite" || item.kind === "meeting_bundle") {
    mergeQueueInvite(map, item);
  }
}

function buildEventsByDay(
  visibleDays: Array<{ date: Date }>,
  calendarEvents: CalendarEventItem[],
  queueItems: QueueListItem[] | undefined,
): Map<string, CalendarEventItem[]> {
  const map = new Map<string, CalendarEventItem[]>();
  for (const { date } of visibleDays) {
    map.set(localDayKey(date), []);
  }

  for (const event of calendarEvents) {
    if (event.status?.toLowerCase() === "cancelled") continue;
    const key = eventDayKey(event.start);
    if (key && map.has(key)) {
      map.get(key)!.push(event);
    }
  }

  for (const item of queueItems ?? []) {
    if (item.status !== "pending" && item.status !== "processing") continue;
    applyQueueItemToCalendarMap(map, item);
  }

  for (const [, dayEvents] of map) {
    dayEvents.sort((a, b) => {
      const aTime = a.start ? new Date(a.start).getTime() : 0;
      const bTime = b.start ? new Date(b.start).getTime() : 0;
      return aTime - bTime;
    });
  }

  return map;
}

function updateDemoEventRsvp(
  events: CalendarEventItem[],
  eventId: string,
  userEmail: string | undefined,
  resp: "accepted" | "declined" | "tentative",
): { updatedEvents: CalendarEventItem[]; updatedEvent: CalendarEventItem | null } {
  let updatedEvent: CalendarEventItem | null = null;
  const updatedEvents = events.map((e) => {
    if (e.id !== eventId) return e;
    const nextAttendees = (e.attendees || []).map((a) => {
      const isUser = userEmail ? a.email?.toLowerCase() === userEmail : !a.organizer;
      return isUser ? { ...a, responseStatus: resp } : a;
    });
    const ev = { ...e, attendees: nextAttendees };
    updatedEvent = ev;
    return ev;
  });
  return { updatedEvents, updatedEvent };
}

function getQueueActionTitle(isProcessing: boolean, kind: string): string {
  if (isProcessing) return "Processing…";
  if (kind === "calendar_delete") return "Delete queued";
  if (kind === "calendar_archive") return "Reschedule pending";
  return "Queued on calendar";
}

function getQueueActionDescription(isProcessing: boolean, kind: string): string {
  if (isProcessing) {
    return "This item is being processed. You can cancel it if it appears stuck.";
  }
  if (kind === "calendar_delete") {
    return "Approve to remove this event from Google Calendar. Cancel request keeps the event and removes the dashed overlay.";
  }
  if (kind === "calendar_invite" || kind === "meeting_bundle") {
    return "This invite is only queued — it is not on Google Calendar yet. Cancel removes it from this preview.";
  }
  return "Review this queued calendar change in Queue or take action here.";
}

function getQueueActionCancelButton(isProcessing: boolean, kind: string): string {
  if (isProcessing) return "Cancel processing";
  if (kind === "calendar_delete") return "Cancel delete";
  return "Remove from queue";
}

function CalendarToolbar({
  isConnected,
  isDemoUser,
  connectHref,
  quickAddText,
  onQuickAddChange,
  onQuickAddSubmit,
  isQuickAddPending,
  onNewInviteClick,
}: Readonly<{
  isConnected: boolean;
  isDemoUser: boolean;
  connectHref: string;
  quickAddText: string;
  onQuickAddChange: (val: string) => void;
  onQuickAddSubmit: (e: React.FormEvent) => void;
  isQuickAddPending: boolean;
  onNewInviteClick: () => void;
}>) {
  if (!isConnected && !isDemoUser) {
    return (
      <div className="thread-app-banner">
        <div className="thread-app-banner-icon">
          <CalIcon size={18} />
        </div>
        <div className="thread-app-banner-text">
          <h4>Calendar not connected</h4>
          <p>Connect Google Calendar via Corsair to see events and send invites in one step.</p>
        </div>
        <a href={connectHref} className="thread-btn-accent">
          Connect
        </a>
      </div>
    );
  }

  return (
    <>
      {isDemoUser && !isConnected ? (
        <div
          className="thread-app-banner"
          style={{
            margin: "0 0 16px 0",
            padding: "10px 14px",
            border: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.015)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            className="thread-app-banner-icon"
            style={{
              padding: 4,
              width: 26,
              height: 26,
              minWidth: 26,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CalIcon size={14} />
          </div>
          <div className="thread-app-banner-text" style={{ flex: 1 }}>
            <h4 style={{ fontSize: 13, margin: 0 }}>Demo calendar — AI quick-add</h4>
            <p style={{ fontSize: 11.5, margin: "2px 0 0", opacity: 0.8 }}>
              5 sample events · 3 AI quick-adds in demo · connect for live sync
            </p>
          </div>
          <a
            href={connectHref}
            className="thread-btn-accent"
            style={{ fontSize: 11, padding: "4px 10px", height: "auto", display: "inline-flex", alignItems: "center" }}
          >
            Connect Calendar
          </a>
        </div>
      ) : null}
      <div className="thread-cal-toolbar">
        <div>
          <h3 className="thread-cal-toolbar-title">
            {isDemoUser && !isConnected ? "Demo calendar preview" : "Your schedule"}
          </h3>
          <p className="thread-cal-toolbar-copy">
            {isDemoUser && !isConnected
              ? "5 sample events · 3 demo calendar AI actions · connect Calendar for live sync"
              : "Live events from Google Calendar. Dashed blocks are queued — approve in Queue to publish."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <form style={{ display: "flex", alignItems: "center", gap: 6 }} onSubmit={onQuickAddSubmit}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 34,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid var(--thread-line)",
                background: "rgba(255,255,255,0.025)",
              }}
            >
              <Sparkles size={12} style={{ color: "var(--thread-dim)", flexShrink: 0 }} />
              <input
                type="text"
                value={quickAddText}
                onChange={(e) => onQuickAddChange(e.target.value)}
                placeholder="Add: Lunch tomorrow · Delete: remove meeting with manu on 27 june"
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  color: "var(--thread-text)",
                  fontSize: 12,
                  width: 240,
                }}
                disabled={isQuickAddPending}
              />
            </div>
            <button
              type="submit"
              className="thread-btn-ghost"
              style={{ fontSize: 12, padding: "6px 10px" }}
              disabled={!quickAddText.trim() || isQuickAddPending}
            >
              {isQuickAddPending ? <Loader2 size={13} className="thread-spin" /> : <Plus size={13} />}
              {isQuickAddPending ? "Adding…" : "Add"}
            </button>
          </form>
          <button type="button" className="thread-btn-accent" onClick={onNewInviteClick}>
            <Plus size={14} />
            New invite
          </button>
        </div>
      </div>
    </>
  );
}

function CalendarHead({
  viewMode,
  periodLabel,
  onNavigate,
  onViewModeChange,
  onTodayClick,
  onRefresh,
  isFetching,
  eventSearchInput,
  onSearchChange,
  dbSearchMode,
  onToggleDbSearch,
}: Readonly<{
  viewMode: CalendarViewMode;
  periodLabel: string;
  onNavigate: (step: -1 | 1) => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onTodayClick: () => void;
  onRefresh: () => void;
  isFetching: boolean;
  eventSearchInput: string;
  onSearchChange: (val: string) => void;
  dbSearchMode: boolean;
  onToggleDbSearch: () => void;
}>) {
  return (
    <div className="thread-cal-head">
      <button
        type="button"
        className="thread-app-iconbtn"
        aria-label={prevNextAriaLabel(viewMode, -1)}
        onClick={() => onNavigate(-1)}
      >
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        className="thread-app-iconbtn"
        aria-label={prevNextAriaLabel(viewMode, 1)}
        onClick={() => onNavigate(1)}
      >
        <ChevronRight size={14} />
      </button>
      <span className="thread-cal-period-label">{periodLabel}</span>

      <div className="thread-cal-view-switch" role="tablist" aria-label="Calendar view">
        {(["day", "week", "month"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={viewMode === mode}
            data-active={viewMode === mode ? "true" : undefined}
            onClick={() => onViewModeChange(mode)}
          >
            {VIEW_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="thread-btn-ghost thread-cal-head-action"
        disabled={isFetching}
        onClick={onRefresh}
      >
        {isFetching ? "Refreshing…" : "Refresh"}
      </button>
      <button
        type="button"
        className="thread-btn-ghost thread-cal-head-action"
        onClick={onTodayClick}
      >
        Today
      </button>
      <div className="thread-cal-search">
        <input
          type="search"
          value={eventSearchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={dbSearchMode ? "Corsair DB search (local cache)…" : "Search events…"}
          aria-label="Search calendar events"
        />
        <button
          type="button"
          className={`thread-inbox-db-toggle${dbSearchMode ? " thread-inbox-db-toggle--active" : ""}`}
          onClick={onToggleDbSearch}
          title="Toggle Corsair DB search (fast local cache)"
        >
          DB
        </button>
      </div>
    </div>
  );
}

function CalendarEventRow({
  event,
  compact,
  isSelected,
  onOpen,
}: Readonly<{
  event: CalendarEventItem;
  compact: boolean;
  isSelected: boolean;
  onOpen: () => void;
}>) {
  const prefix = getEventPrefix(event);
  return (
    <button
      key={event.id}
      type="button"
      className="thread-cal-event"
      data-compact={compact ? "true" : undefined}
      data-selected={isSelected}
      data-pending={event.pending ? "true" : undefined}
      data-pending-archive={event.pendingArchive ? "true" : undefined}
      data-pending-delete={event.pendingDelete ? "true" : undefined}
      onClick={onOpen}
    >
      <span className="thread-cal-event-time">
        {prefix}
        {formatEventTime(event.start)}
      </span>
      <span className="thread-cal-event-title">
        {event.isRecurring ? (
          <Repeat size={10} className="thread-cal-event-recur" aria-label="Recurring" />
        ) : null}
        {event.summary}
      </span>
    </button>
  );
}

function DayColumnBody({
  isConnected,
  isDemoUser,
  dayEvents,
  viewMode,
  compact,
  visibleEvents,
  hiddenCount,
  selectedEventId,
  onOpenEvent,
  onFocusDay,
  date,
}: Readonly<{
  isConnected: boolean;
  isDemoUser: boolean;
  dayEvents: CalendarEventItem[];
  viewMode: CalendarViewMode;
  compact: boolean;
  visibleEvents: CalendarEventItem[];
  hiddenCount: number;
  selectedEventId?: string;
  onOpenEvent: (event: CalendarEventItem) => void;
  onFocusDay: (date: Date) => void;
  date: Date;
}>) {
  if (!isConnected && !isDemoUser) {
    return <div className="thread-cal-empty-note">Connect Calendar to sync</div>;
  }

  if (dayEvents.length === 0) {
    return (
      <div className="thread-cal-empty-note">
        {viewMode === "day" ? "Nothing scheduled — enjoy the free time." : "No events"}
      </div>
    );
  }

  return (
    <>
      {visibleEvents.map((event) => (
        <CalendarEventRow
          key={event.id}
          event={event}
          compact={compact}
          isSelected={selectedEventId === event.id}
          onOpen={() => onOpenEvent(event)}
        />
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          className="thread-cal-more-btn"
          onClick={() => onFocusDay(date)}
        >
          +{hiddenCount} more
        </button>
      ) : null}
    </>
  );
}

function CalendarGrid({
  viewMode,
  visibleDays,
  eventsByDay,
  todayKey,
  selectedEventId,
  isConnected,
  isDemoUser,
  onFocusDay,
  onOpenEvent,
}: Readonly<{
  viewMode: CalendarViewMode;
  visibleDays: Array<{ date: Date; inMonth: boolean }>;
  eventsByDay: Map<string, CalendarEventItem[]>;
  todayKey: string;
  selectedEventId?: string;
  isConnected: boolean;
  isDemoUser: boolean;
  onFocusDay: (date: Date) => void;
  onOpenEvent: (event: CalendarEventItem) => void;
}>) {
  return (
    <>
      {viewMode === "month" ? (
        <div className="thread-cal-month-head" aria-hidden="true">
          {DOW.map((label) => (
            <div key={label} className="thread-cal-month-dow">
              {label}
            </div>
          ))}
        </div>
      ) : null}

      <div className="thread-cal-grid" data-view={viewMode}>
        {visibleDays.map(({ date, inMonth }) => {
          const key = localDayKey(date);
          const isToday = key === todayKey;
          const dayEvents = eventsByDay.get(key) ?? [];
          const compact = viewMode === "month";
          const visibleEvents = compact ? dayEvents.slice(0, MONTH_EVENT_CAP) : dayEvents;
          const hiddenCount = compact ? Math.max(0, dayEvents.length - MONTH_EVENT_CAP) : 0;
          return (
            <div
              key={key}
              className="thread-cal-col"
              data-outside={viewMode === "month" && !inMonth ? "true" : undefined}
            >
              <button
                type="button"
                className="thread-cal-colhead"
                data-today={isToday}
                onClick={() => onFocusDay(date)}
                title={`Open ${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
              >
                {viewMode !== "month" ? (
                  <div className="thread-cal-dow">{DOW[(date.getDay() + 6) % 7]}</div>
                ) : null}
                <div className="thread-cal-dom" data-today={isToday}>
                  {date.getDate()}
                </div>
              </button>
              <div className="thread-cal-body">
                <DayColumnBody
                  isConnected={isConnected}
                  isDemoUser={isDemoUser}
                  dayEvents={dayEvents}
                  viewMode={viewMode}
                  compact={compact}
                  visibleEvents={visibleEvents}
                  hiddenCount={hiddenCount}
                  selectedEventId={selectedEventId}
                  onOpenEvent={onOpenEvent}
                  onFocusDay={onFocusDay}
                  date={date}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CalendarBody({
  eventsLoading,
  isConnected,
  isError,
  errorMessage,
  onRetry,
  mobileListEvents,
  viewMode,
  visibleDays,
  eventsByDay,
  todayKey,
  selectedEventId,
  isDemoUser,
  onFocusDay,
  onOpenEvent,
}: Readonly<{
  eventsLoading: boolean;
  isConnected: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  mobileListEvents: CalendarEventItem[];
  viewMode: CalendarViewMode;
  visibleDays: Array<{ date: Date; inMonth: boolean }>;
  eventsByDay: Map<string, CalendarEventItem[]>;
  todayKey: string;
  selectedEventId?: string;
  isDemoUser: boolean;
  onFocusDay: (date: Date) => void;
  onOpenEvent: (event: CalendarEventItem) => void;
}>) {
  if (eventsLoading && isConnected) {
    return <SkeletonList count={7} />;
  }

  if (isError && isConnected) {
    return (
      <QueryErrorState
        title="Couldn't load calendar"
        message={errorMessage ?? "Failed to fetch calendar"}
        onRetry={onRetry}
      />
    );
  }

  return (
    <>
      <div className="thread-cal-mobile-list">
        {mobileListEvents.length === 0 ? (
          <div className="thread-cal-empty-note">
            {EMPTY_PERIOD_NOTES[viewMode]}
          </div>
        ) : (
          mobileListEvents.map((event) => (
            <button
              key={`mobile-${event.id}`}
              type="button"
              className="thread-cal-mobile-item"
              onClick={() => onOpenEvent(event)}
            >
              <span className="thread-cal-mobile-item-when">
                {formatEventWhen(event.start, event.end)}
              </span>
              <span className="thread-cal-mobile-item-title">{event.summary}</span>
            </button>
          ))
        )}
      </div>

      <CalendarGrid
        viewMode={viewMode}
        visibleDays={visibleDays}
        eventsByDay={eventsByDay}
        todayKey={todayKey}
        selectedEventId={selectedEventId}
        isConnected={isConnected}
        isDemoUser={isDemoUser}
        onFocusDay={onFocusDay}
        onOpenEvent={onOpenEvent}
      />
    </>
  );
}

function useModalBackdrop(
  isOpen: boolean,
  onClose: () => void,
  isBusy = false,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    const handleClick = (e: MouseEvent) => {
      if (e.target === dialog && !isBusy) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isBusy) {
        onClose();
      }
    };

    dialog?.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      dialog?.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, isBusy]);

  return dialogRef;
}

function CreateEventModal({
  isOpen,
  onClose,
  summary,
  setSummary,
  attendee,
  setAttendee,
  isAllDay,
  setIsAllDay,
  allDayStart,
  setAllDayStart,
  allDayEnd,
  setAllDayEnd,
  startAt,
  setStartAt,
  endAt,
  setEndAt,
  recurrenceRule,
  setRecurrenceRule,
  customRrule,
  setCustomRrule,
  conflicts,
  isPending,
  onSubmit,
  onCheckFreeBusy,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  setSummary: (val: string) => void;
  attendee: string;
  setAttendee: (val: string) => void;
  isAllDay: boolean;
  setIsAllDay: (val: boolean) => void;
  allDayStart: string;
  setAllDayStart: (val: string) => void;
  allDayEnd: string;
  setAllDayEnd: (val: string) => void;
  startAt: string;
  setStartAt: (val: string) => void;
  endAt: string;
  setEndAt: (val: string) => void;
  recurrenceRule: string;
  setRecurrenceRule: (val: string) => void;
  customRrule: string;
  setCustomRrule: (val: string) => void;
  conflicts: CalendarEventItem[];
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCheckFreeBusy: (endVal: string) => void;
}>) {
  const dialogRef = useModalBackdrop(isOpen, onClose, isPending);
  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      className="thread-modal-backdrop"
    >
      <div className="thread-modal">
        <div className="thread-modal-head">
          <h3>Send calendar invite</h3>
          <button type="button" className="thread-app-iconbtn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <form className="thread-modal-form" onSubmit={onSubmit}>
          <label className="thread-set-label" htmlFor="event-summary">
            Title
          </label>
          <input
            id="event-summary"
            className="thread-set-input"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder="Product sync"
            required
          />

          <label className="thread-set-label" htmlFor="event-attendee">
            Guest email
          </label>
          <input
            id="event-attendee"
            className="thread-set-input"
            type="email"
            value={attendee}
            onChange={(event) => setAttendee(event.target.value)}
            placeholder="guest@company.com"
          />

          {/* All-day toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 4 }}>
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: "var(--thread-accent-bright, #60a5fa)" }}
            />
            <span className="thread-set-label" style={{ marginBottom: 0 }}>All-day event</span>
          </label>

          {isAllDay ? (
            <div className="thread-modal-row">
              <div>
                <label className="thread-set-label" htmlFor="event-allday-start">Start date</label>
                <input
                  id="event-allday-start"
                  className="thread-set-input"
                  type="date"
                  value={allDayStart}
                  onChange={(e) => setAllDayStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="thread-set-label" htmlFor="event-allday-end">End date</label>
                <input
                  id="event-allday-end"
                  className="thread-set-input"
                  type="date"
                  value={allDayEnd}
                  min={allDayStart}
                  onChange={(e) => setAllDayEnd(e.target.value)}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="thread-modal-row">
              <div>
                <label className="thread-set-label" htmlFor="event-start">
                  Starts
                </label>
                <input
                  id="event-start"
                  className="thread-set-input"
                  type="datetime-local"
                  value={startAt}
                  onChange={(event) => setStartAt(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="thread-set-label" htmlFor="event-end">
                  Ends
                </label>
                <input
                  id="event-end"
                  className="thread-set-input"
                  type="datetime-local"
                  value={endAt}
                  onChange={(event) => {
                    setEndAt(event.target.value);
                    onCheckFreeBusy(event.target.value);
                  }}
                  required
                />
              </div>
            </div>
          )}

          <label className="thread-set-label" htmlFor="event-recurrence">
            Repeat
          </label>
          <select
            id="event-recurrence"
            className="thread-set-input"
            value={recurrenceRule}
            onChange={(event) => setRecurrenceRule(event.target.value)}
          >
            <option value="">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom RRULE…</option>
          </select>

          {recurrenceRule === "custom" ? (
            <>
              <label className="thread-set-label" htmlFor="event-custom-rrule">
                Custom RRULE
              </label>
              <input
                id="event-custom-rrule"
                className="thread-set-input"
                value={customRrule}
                onChange={(event) => setCustomRrule(event.target.value)}
                placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
              />
            </>
          ) : null}

          {conflicts.length > 0 ? (
            <div className="thread-cal-conflict-warning">
              <p className="thread-cal-conflict-title">
                ⚠ {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected
              </p>
              <ul className="thread-cal-conflict-list">
                {conflicts.map((c) => (
                  <li key={c.id} className="thread-cal-conflict-item">
                    {c.summary}
                    {c.start
                      ? ` · ${new Date(c.start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="thread-modal-actions">
            <button type="button" className="thread-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="thread-btn-accent" disabled={isPending}>
              <ListChecks size={14} />
              {isPending ? "Queuing…" : "Queue invite"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

function EventTags({ event }: Readonly<{ event: CalendarEventItem }>) {
  const attendeeCount = event.attendees?.length ?? 0;
  return (
    <div className="thread-cal-event-tags">
      {event.isRecurring ? (
        <span className="thread-cal-event-tag">
          <Repeat size={12} />
          Recurring series
        </span>
      ) : null}
      {attendeeCount > 0 ? (
        <span className="thread-cal-event-tag">
          <Users size={12} />
          {attendeeCount} guest{attendeeCount === 1 ? "" : "s"}
        </span>
      ) : null}
      {event.location ? (
        <span className="thread-cal-event-tag">{event.location}</span>
      ) : null}
    </div>
  );
}

function RecurringScopeSelector({
  isRecurring,
  recurringEditScope,
  setRecurringEditScope,
}: Readonly<{
  isRecurring?: boolean;
  recurringEditScope: RecurringEditScope;
  setRecurringEditScope: (scope: RecurringEditScope) => void;
}>) {
  if (!isRecurring) return null;
  return (
    <div className="thread-cal-recurring-scope" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span className="thread-set-label">Apply changes to</span>
      <label className="thread-cal-scope-option" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input
          type="radio"
          name="recurring-edit-scope"
          checked={recurringEditScope === "instance"}
          onChange={() => setRecurringEditScope("instance")}
        />
        <span>This event only</span>
      </label>
      <label className="thread-cal-scope-option" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input
          type="radio"
          name="recurring-edit-scope"
          checked={recurringEditScope === "series"}
          onChange={() => setRecurringEditScope("series")}
        />
        <span>All events in the series</span>
      </label>
      <label className="thread-cal-scope-option" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
        <input
          type="radio"
          name="recurring-edit-scope"
          checked={recurringEditScope === "following"}
          onChange={() => setRecurringEditScope("following")}
        />
        <span>This and following events</span>
      </label>
      <p className="thread-cal-event-detail-copy" style={{ margin: 0 }}>
        {RECURRING_SCOPE_DESCRIPTIONS[recurringEditScope] ?? RECURRING_SCOPE_DESCRIPTIONS.instance}
      </p>
    </div>
  );
}

function EventAttendeesList({
  attendees,
}: Readonly<{
  attendees: CalendarEventItem["attendees"];
}>) {
  if (!attendees || attendees.length === 0) return null;
  return (
    <ul className="thread-cal-attendee-list">
      {attendees.map((attendee) => (
        <li key={attendee.email} className="thread-cal-attendee-item">
          <span className="thread-cal-attendee-name">
            {attendee.displayName || attendee.email}
            {attendee.organizer ? (
              <span style={{ fontSize: 10.5, color: "var(--thread-dim)", marginLeft: 4 }}>(organizer)</span>
            ) : null}
          </span>
          {attendee.responseStatus ? (
            <span className="thread-rsvp-badge" data-status={attendee.responseStatus}>
              {RSVP_STATUS_LABELS[attendee.responseStatus as RsvpResponseStatus] ?? "Pending"}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function EventRsvpButtons({
  attendees,
  userEmail,
  isRespondPending,
  onRsvp,
}: Readonly<{
  attendees: CalendarEventItem["attendees"];
  userEmail?: string;
  isRespondPending: boolean;
  onRsvp: (resp: RsvpResponseStatus) => void;
}>) {
  if (!attendees?.some((a) => a.responseStatus)) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: "var(--thread-muted)", fontFamily: "var(--thread-mono)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Your RSVP
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        {RSVP_OPTIONS.map(({ resp, label, icon: Icon }) => {
          const isCurrent = userEmail
            ? attendees.some(
                (a) => a.email?.toLowerCase() === userEmail && a.responseStatus === resp,
              )
            : attendees.find((a) => a.responseStatus === resp && !a.organizer);
          return (
            <button
              key={resp}
              type="button"
              className="thread-btn-ghost"
              disabled={isRespondPending}
              data-active={isCurrent ? "true" : undefined}
              style={{
                fontSize: 12,
                padding: "5px 10px",
                opacity: isCurrent ? 1 : 0.7,
                border: isCurrent ? "1px solid var(--thread-accent-bright, #60a5fa)" : undefined,
              }}
              onClick={() => onRsvp(resp)}
            >
              <Icon size={12} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RescheduleInputs({
  allDay,
  start,
  onStartChange,
  end,
  onEndChange,
}: Readonly<{
  allDay?: boolean;
  start: string;
  onStartChange: (val: string) => void;
  end: string;
  onEndChange: (val: string) => void;
}>) {
  const inputType = allDay ? "date" : "datetime-local";
  return (
    <div className="thread-modal-row" style={{ marginTop: 8 }}>
      <div>
        <label className="thread-set-label" htmlFor="reschedule-start">
          New start
        </label>
        <input
          id="reschedule-start"
          className="thread-set-input"
          type={inputType}
          value={start}
          onChange={(event) => onStartChange(event.target.value)}
        />
      </div>
      <div>
        <label className="thread-set-label" htmlFor="reschedule-end">
          New end
        </label>
        <input
          id="reschedule-end"
          className="thread-set-input"
          type={inputType}
          value={end}
          onChange={(event) => onEndChange(event.target.value)}
        />
      </div>
    </div>
  );
}

function EventDetailModal({
  selectedEvent,
  onClose,
  eventBusy,
  showPrep,
  onTogglePrep,
  recurringEditScope,
  setRecurringEditScope,
  userEmail,
  isRespondPending,
  onRsvp,
  rescheduleStart,
  setRescheduleStart,
  rescheduleEnd,
  setRescheduleEnd,
  onReschedule,
  isReschedulePending,
  onOpenCancelConfirm,
  onOpenDeleteConfirm,
}: Readonly<{
  selectedEvent: CalendarEventItem | null;
  onClose: () => void;
  eventBusy: boolean;
  showPrep: boolean;
  onTogglePrep: () => void;
  recurringEditScope: RecurringEditScope;
  setRecurringEditScope: (scope: RecurringEditScope) => void;
  userEmail?: string;
  isRespondPending: boolean;
  onRsvp: (resp: RsvpResponseStatus) => void;
  rescheduleStart: string;
  setRescheduleStart: (val: string) => void;
  rescheduleEnd: string;
  setRescheduleEnd: (val: string) => void;
  onReschedule: () => void;
  isReschedulePending: boolean;
  onOpenCancelConfirm: () => void;
  onOpenDeleteConfirm: () => void;
}>) {
  const dialogRef = useModalBackdrop(Boolean(selectedEvent), onClose, eventBusy);
  if (!selectedEvent) return null;

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      className="thread-modal-backdrop"
    >
      <div className="thread-modal thread-cal-event-modal">
        <div className="thread-modal-head">
          <h3>{selectedEvent.summary}</h3>
          <button
            type="button"
            className="thread-btn-ghost"
            style={{
              fontSize: 12,
              padding: "5px 10px",
              marginLeft: "auto",
              color: showPrep ? "var(--thread-accent)" : undefined,
            }}
            onClick={onTogglePrep}
          >
            <Sparkles size={13} style={{ marginRight: 4, verticalAlign: -1 }} />
            {showPrep ? "Hide prep" : "Meeting Prep"}
          </button>
          <button
            type="button"
            className="thread-app-iconbtn"
            disabled={eventBusy}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        {showPrep ? (
          <MeetingPrepPanel
            eventId={selectedEvent.id}
            timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
            onOpenThread={(threadId) => {
              onClose();
              window.location.href = `/inbox?thread=${encodeURIComponent(threadId)}`;
            }}
          />
        ) : null}
        <div className="thread-cal-event-detail">
          <p className="thread-cal-event-when">
            {formatEventWhen(selectedEvent.start, selectedEvent.end)}
          </p>
          <EventTags event={selectedEvent} />
          <RecurringScopeSelector
            isRecurring={selectedEvent.isRecurring}
            recurringEditScope={recurringEditScope}
            setRecurringEditScope={setRecurringEditScope}
          />
          <EventAttendeesList attendees={selectedEvent.attendees} />
          <EventRsvpButtons
            attendees={selectedEvent.attendees}
            userEmail={userEmail}
            isRespondPending={isRespondPending}
            onRsvp={onRsvp}
          />

          <ul className="thread-cal-event-actions-legend">
            <li>
              <strong>Reschedule</strong> — queue new dates; nothing changes until you approve.
            </li>
            <li>
              <strong>Delete</strong> — queue removal; nothing is deleted until you approve in
              Queue.
            </li>
          </ul>
          <RescheduleInputs
            allDay={selectedEvent.allDay}
            start={rescheduleStart}
            onStartChange={setRescheduleStart}
            end={rescheduleEnd}
            onEndChange={setRescheduleEnd}
          />
          {selectedEvent.htmlLink ? (
            <a
              href={selectedEvent.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="thread-cal-event-open"
            >
              <ExternalLink size={13} />
              Open in Google Calendar
            </a>
          ) : null}
        </div>
        <div className="thread-modal-actions">
          <button
            type="button"
            className="thread-btn-ghost"
            disabled={eventBusy}
            onClick={onReschedule}
          >
            <ListChecks size={14} />
            {isReschedulePending ? "Queuing…" : "Reschedule"}
          </button>
          <button
            type="button"
            className="thread-btn-ghost"
            disabled={eventBusy}
            onClick={onOpenCancelConfirm}
          >
            <XCircle size={14} />
            Cancel
          </button>
          <button
            type="button"
            className="thread-btn-ghost thread-cal-event-delete"
            disabled={eventBusy}
            onClick={onOpenDeleteConfirm}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>
    </dialog>
  );
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  selectedEvent,
  recurringEditScope,
  setRecurringEditScope,
  isPending,
  onConfirm,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: CalendarEventItem | null;
  recurringEditScope: RecurringEditScope;
  setRecurringEditScope: (scope: RecurringEditScope) => void;
  isPending: boolean;
  onConfirm: () => void;
}>) {
  const dialogRef = useModalBackdrop(isOpen && Boolean(selectedEvent), onClose, isPending);
  if (!isOpen || !selectedEvent) return null;

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      className="thread-modal-backdrop thread-modal-backdrop--confirm"
    >
      <div className="thread-modal thread-cal-delete-modal thread-cal-confirm-modal">
        <div className="thread-modal-head">
          <h3>Queue delete?</h3>
          <button
            type="button"
            className="thread-app-iconbtn"
            disabled={isPending}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div className="thread-cal-event-detail">
          <p className="thread-cal-confirm-title">{selectedEvent.summary}</p>
          <p className="thread-cal-event-detail-copy">
            This adds a delete request to your approval queue. The event stays on Google Calendar
            until you approve.
            {selectedEvent.isRecurring ? (
              <>
                {" "}
                {RECURRING_DELETE_DESCRIPTIONS[recurringEditScope] ?? RECURRING_DELETE_DESCRIPTIONS.instance}
              </>
            ) : null}
          </p>
          {selectedEvent.isRecurring ? (
            <div className="thread-cal-recurring-scope" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="thread-set-label">Delete scope</span>
              <label className="thread-cal-scope-option" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input
                  type="radio"
                  name="recurring-delete-scope"
                  checked={recurringEditScope === "instance"}
                  onChange={() => setRecurringEditScope("instance")}
                />
                <span>This event only</span>
              </label>
              <label className="thread-cal-scope-option" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input
                  type="radio"
                  name="recurring-delete-scope"
                  checked={recurringEditScope === "series"}
                  onChange={() => setRecurringEditScope("series")}
                />
                <span>All events in the series</span>
              </label>
              <label className="thread-cal-scope-option" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input
                  type="radio"
                  name="recurring-delete-scope"
                  checked={recurringEditScope === "following"}
                  onChange={() => setRecurringEditScope("following")}
                />
                <span>This and following events</span>
              </label>
            </div>
          ) : null}
        </div>
        <div className="thread-modal-actions">
          <button
            type="button"
            className="thread-btn-ghost"
            disabled={isPending}
            onClick={onClose}
          >
            Keep event
          </button>
          <button
            type="button"
            className="thread-btn-ghost thread-cal-event-delete"
            disabled={isPending}
            onClick={onConfirm}
          >
            <Trash2 size={14} />
            {isPending ? "Queuing…" : "Add to queue"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function CancelConfirmModal({
  isOpen,
  onClose,
  selectedEvent,
  recurringEditScope,
  setRecurringEditScope,
  isPending,
  onConfirm,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  selectedEvent: CalendarEventItem | null;
  recurringEditScope: RecurringEditScope;
  setRecurringEditScope: (scope: RecurringEditScope) => void;
  isPending: boolean;
  onConfirm: () => void;
}>) {
  const dialogRef = useModalBackdrop(isOpen && Boolean(selectedEvent), onClose, isPending);
  if (!isOpen || !selectedEvent) return null;

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      className="thread-modal-backdrop thread-modal-backdrop--confirm"
    >
      <div className="thread-modal thread-cal-delete-modal thread-cal-confirm-modal">
        <div className="thread-modal-head">
          <h3>Queue cancellation?</h3>
          <button
            type="button"
            className="thread-app-iconbtn"
            disabled={isPending}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div className="thread-cal-event-detail">
          <p className="thread-cal-confirm-title">{selectedEvent.summary}</p>
          <p className="thread-cal-event-detail-copy">
            This queues a cancellation email to all attendees and removes the event. Nothing is sent
            until you approve in Queue.
            {selectedEvent.isRecurring ? (
              <>
                {" "}
                {RECURRING_DELETE_DESCRIPTIONS[recurringEditScope] ?? RECURRING_DELETE_DESCRIPTIONS.instance}
              </>
            ) : null}
          </p>
          {selectedEvent.isRecurring ? (
            <div className="thread-cal-recurring-scope" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="thread-set-label">Cancel scope</span>
              <label className="thread-cal-scope-option" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input
                  type="radio"
                  name="recurring-cancel-scope"
                  checked={recurringEditScope === "instance"}
                  onChange={() => setRecurringEditScope("instance")}
                />
                <span>This event only</span>
              </label>
              <label className="thread-cal-scope-option" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input
                  type="radio"
                  name="recurring-cancel-scope"
                  checked={recurringEditScope === "series"}
                  onChange={() => setRecurringEditScope("series")}
                />
                <span>All events in the series</span>
              </label>
              <label className="thread-cal-scope-option" style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input
                  type="radio"
                  name="recurring-cancel-scope"
                  checked={recurringEditScope === "following"}
                  onChange={() => setRecurringEditScope("following")}
                />
                <span>This and following events</span>
              </label>
            </div>
          ) : null}
        </div>
        <div className="thread-modal-actions">
          <button
            type="button"
            className="thread-btn-ghost"
            disabled={isPending}
            onClick={onClose}
          >
            Keep event
          </button>
          <button
            type="button"
            className="thread-btn-ghost thread-cal-event-delete"
            disabled={isPending}
            onClick={onConfirm}
          >
            <Trash2 size={14} />
            {isPending ? "Queuing…" : "Add to queue"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function QueueActionModal({
  queueAction,
  isDismissPending,
  isApprovePending,
  onClose,
  onDismiss,
  onOpenQueue,
}: Readonly<{
  queueAction: { event: CalendarEventItem; item: QueueListItem } | null;
  isDismissPending: boolean;
  isApprovePending: boolean;
  onClose: () => void;
  onDismiss: (id: string) => void;
  onOpenQueue: () => void;
}>) {
  const isBusy = isDismissPending || isApprovePending;
  const dialogRef = useModalBackdrop(Boolean(queueAction), onClose, isBusy);
  if (!queueAction) return null;
  const isProcessing = queueAction.item.status === "processing";
  const title = getQueueActionTitle(isProcessing, queueAction.item.kind);
  const description = getQueueActionDescription(isProcessing, queueAction.item.kind);
  const cancelText = getQueueActionCancelButton(isProcessing, queueAction.item.kind);

  return (
    <dialog
      ref={dialogRef}
      open
      aria-modal="true"
      className="thread-modal-backdrop thread-modal-backdrop--confirm"
    >
      <div className="thread-modal thread-cal-confirm-modal">
        <div className="thread-modal-head">
          <h3>{title}</h3>
          <button
            type="button"
            className="thread-app-iconbtn"
            disabled={isBusy}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <div className="thread-cal-event-detail">
          <p className="thread-cal-confirm-title">{queueAction.event.summary}</p>
          <p className="thread-cal-event-detail-copy">{description}</p>
        </div>
        <div className="thread-modal-actions">
          <button
            type="button"
            className="thread-btn-ghost"
            disabled={isBusy}
            onClick={() => onDismiss(queueAction.item.id)}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="thread-btn-ghost"
            disabled={isBusy}
            onClick={onOpenQueue}
          >
            Open Queue
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default function CalendarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [viewAnchor, setViewAnchor] = useState(() => new Date());
  const [showCreate, setShowCreate] = useState(false);
  const [summary, setSummary] = useState("");
  const [attendee, setAttendee] = useState("");
  const [startAt, setStartAt] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 86_400_000)),
  );
  const [endAt, setEndAt] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 86_400_000 + 3_600_000)),
  );
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [showPrep, setShowPrep] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [eventSearchInput, setEventSearchInput] = useState("");
  const [dbSearchMode, setDbSearchMode] = useState(false);
  const [conflicts, setConflicts] = useState<CalendarEventItem[]>([]);
  const [isAllDay, setIsAllDay] = useState(false);
  const [allDayStart, setAllDayStart] = useState(() => {
    const d = new Date(Date.now() + 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [allDayEnd, setAllDayEnd] = useState(() => {
    const d = new Date(Date.now() + 2 * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [recurrenceRule, setRecurrenceRule] = useState("");
  const [customRrule, setCustomRrule] = useState("FREQ=WEEKLY;BYDAY=MO");
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleEnd, setRescheduleEnd] = useState("");
  const [recurringEditScope, setRecurringEditScope] = useState<RecurringEditScope>("instance");
  const [queueAction, setQueueAction] = useState<{ event: CalendarEventItem; item: QueueListItem } | null>(null);

  const visibleDays = useMemo(() => getVisibleDays(viewMode, viewAnchor), [viewMode, viewAnchor]);
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const eventQuery = useMemo(() => {
    const bounds = queryBoundsForView(viewMode, viewAnchor);
    const q = eventSearchInput.trim();
    return {
      ...bounds,
      maxResults: viewMode === "month" ? 250 : 100,
      timeZone: browserTimeZone,
      ...(q ? { q } : {}),
    };
  }, [viewMode, viewAnchor, browserTimeZone, eventSearchInput]);
  const todayKey = localDayKey(new Date());
  const periodLabel = viewPeriodLabel(viewMode, viewAnchor);

  const statusQuery = trpc.calendar.connectionStatus.useQuery({});
  const meQuery = trpc.auth.me.useQuery({});
  const userEmail = meQuery.data?.email?.toLowerCase();
  const isConnected = statusQuery.data?.googlecalendar === "connected";
  const connectHref = `/api-connect/calendar?state=${encodeURIComponent("/calendar")}`;

  const { isDemo: isDemoUser, tryFeature, modal: demoModal } = useDemoAiGuard(userEmail, "calendar");

  const [customDemoEvents, setCustomDemoEvents] = useState<CalendarEventItem[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem("thread_demo_custom_events");
    return saved ? JSON.parse(saved) : makeDemoEvents();
  });

  useEffect(() => {
    if (isDemoUser && typeof window !== "undefined") {
      localStorage.setItem("thread_demo_custom_events", JSON.stringify(customDemoEvents));
    }
  }, [customDemoEvents, isDemoUser]);

  const eventsQuery = trpc.calendar.listEvents.useQuery(eventQuery, {
    enabled: isConnected && (!dbSearchMode || !eventSearchInput.trim()),
    refetchOnMount: "always",
    refetchInterval: isConnected && !dbSearchMode ? 30_000 : false,
    staleTime: 0,
  });

  const dbSearchTerm = eventSearchInput.trim();
  const dbEventsQuery = trpc.calendar.searchEventsDb.useQuery(
    { query: dbSearchTerm, limit: 100 },
    { enabled: isConnected && dbSearchMode && dbSearchTerm.length > 0, staleTime: 30_000 },
  );

  const calendarEvents = useMemo(() => {
    if (isDemoUser && !isConnected) return customDemoEvents;
    if (dbSearchMode && dbSearchTerm) return dbEventsQuery.data?.events ?? [];
    return eventsQuery.data?.events ?? [];
  }, [isDemoUser, isConnected, customDemoEvents, dbSearchMode, dbSearchTerm, dbEventsQuery.data?.events, eventsQuery.data?.events]);

  const eventsLoading =
    dbSearchMode && dbSearchTerm ? dbEventsQuery.isLoading : eventsQuery.isLoading;

  useEffect(() => {
    if (!selectedEvent) return;
    setRecurringEditScope("instance");
    if (selectedEvent.allDay) {
      setRescheduleStart(selectedEvent.start?.slice(0, 10) ?? "");
      setRescheduleEnd(selectedEvent.end?.slice(0, 10) ?? selectedEvent.start?.slice(0, 10) ?? "");
    } else {
      setRescheduleStart(isoToLocalDateTimeInput(selectedEvent.start));
      setRescheduleEnd(isoToLocalDateTimeInput(selectedEvent.end) || isoToLocalDateTimeInput(selectedEvent.start));
    }
  }, [selectedEvent]);

  const pendingQueue = trpc.queue.list.useQuery(
    { status: "pending" },
    { enabled: isConnected, staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true },
  );

  const checkFreeBusy = trpc.calendar.checkFreeBusy.useMutation({
    onSuccess: (data) => {
      if ("unavailable" in data && data.unavailable) {
        setConflicts([]);
        toast.message("Could not verify conflicts — calendar busy check unavailable.");
        return;
      }
      setConflicts(data.conflicts as CalendarEventItem[]);
    },
  });

  const queueInvite = trpc.queue.enqueueCalendar.useMutation({
    onSuccess: async (item) => {
      await utils.queue.pendingCount.invalidate();
      await utils.queue.list.invalidate();
      const msg = queueResultMessage(item);
      toast.success(msg.title);
      setShowCreate(false);
      setSummary("");
      setAttendee("");
      setConflicts([]);
    },
    onError: (error) => toast.error(error.message),
  });

  const refreshEvents = async () => {
    await utils.calendar.listEvents.invalidate();
    await eventsQuery.refetch();
  };

  const queueArchive = trpc.queue.enqueueCalendarArchive.useMutation({
    onSuccess: async (item) => {
      await utils.queue.pendingCount.invalidate();
      await utils.queue.list.invalidate();
      setSelectedEvent(null);
      toast.success(queueResultMessage(item).title);
    },
    onError: (error) => toast.error(error.message),
  });

  const respondToEvent = trpc.calendar.respondToEvent.useMutation({
    onSuccess: async (updated) => {
      toast.success("RSVP updated");
      setSelectedEvent(updated as CalendarEventItem);
      await utils.calendar.listEvents.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const queueDelete = trpc.queue.enqueueCalendarDelete.useMutation({
    onSuccess: async (item) => {
      await utils.queue.pendingCount.invalidate();
      await utils.queue.list.invalidate();
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
      setShowCancelConfirm(false);
      toast.success(queueResultMessage(item).title);
    },
    onError: (error) => toast.error(error.message),
  });

  const dismissQueueItem = trpc.queue.dismiss.useMutation({
    onSuccess: async (_data, vars) => {
      const item = queueAction?.item.id === vars.id ? queueAction.item : null;
      setQueueAction(null);
      utils.queue.list.setData({ status: "pending" }, (old) => {
        if (!old) return old;
        return { ...old, items: old.items.filter((entry) => entry.id !== vars.id) };
      });
      await utils.queue.list.invalidate();
      await utils.queue.pendingCount.invalidate();
      if (item?.kind === "calendar_delete") {
        toast.success("Delete request cancelled — event stays on your calendar");
      } else if (item?.kind === "calendar_invite" || item?.kind === "meeting_bundle") {
        toast.success("Queued invite removed");
      } else {
        toast.success("Removed from queue");
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const approveQueueItem = trpc.queue.approve.useMutation({
    onSuccess: async (data) => {
      setQueueAction(null);
      await utils.queue.list.invalidate();
      await utils.queue.pendingCount.invalidate();
      await utils.calendar.listEvents.invalidate();
      toast.success(queueResultMessage(data).title);
    },
    onError: (error) => toast.error(error.message),
  });

  const [quickAddText, setQuickAddText] = useState("");
  const quickAddEvent = trpc.calendar.quickAddEvent.useMutation({
    onSuccess: async (item) => {
      setQuickAddText("");
      toast.success(queueResultMessage(item).title);
      await utils.queue.pendingCount.invalidate();
      await utils.queue.list.invalidate();
      await utils.calendar.listEvents.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const banner = useMemo(() => {
    if (searchParams.get("calendar") === "connected") {
      return { type: "success" as const, text: "Google Calendar connected successfully." };
    }
    const error = searchParams.get("error");
    if (error) return { type: "error" as const, text: error };
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("calendar") === "connected") {
      void utils.calendar.connectionStatus.invalidate();
    }
  }, [searchParams, utils]);

  const [deepLinkSearched, setDeepLinkSearched] = useState(false);
  const deepLinkEventId = searchParams.get("event");

  const wideEventsQuery = trpc.calendar.listEvents.useQuery(
    {
      timeMin: new Date(Date.now() - 30 * 86_400_000).toISOString(),
      timeMax: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      maxResults: 200,
      timeZone: browserTimeZone,
    },
    {
      enabled: Boolean(deepLinkEventId) && !deepLinkSearched && isConnected,
      staleTime: 5 * 60_000,
    },
  );

  useEffect(() => {
    const eventId = searchParams.get("event");
    if (!eventId) return;

    if (eventsQuery.data?.events) {
      const found = eventsQuery.data.events.find((e) => e.id === eventId);
      if (found) {
        setSelectedEvent(found as CalendarEventItem);
        setShowPrep(true);
        setDeepLinkSearched(true);
        return;
      }
    }

    if (wideEventsQuery.data?.events) {
      const found = wideEventsQuery.data.events.find((e) => e.id === eventId);
      if (found) {
        if (found.start) setViewAnchor(new Date(found.start));
        setSelectedEvent(found as CalendarEventItem);
        setShowPrep(true);
      }
      setDeepLinkSearched(true);
    }
  }, [searchParams, eventsQuery.data, wideEventsQuery.data]);

  const eventsByDay = useMemo(
    () => buildEventsByDay(visibleDays, calendarEvents, pendingQueue.data?.items),
    [visibleDays, calendarEvents, pendingQueue.data?.items],
  );

  const eventBusy = queueArchive.isPending || queueDelete.isPending;

  const openQueueOverlay = (event: CalendarEventItem) => {
    const item = resolveQueueItemForEvent(event, pendingQueue.data?.items ?? []);
    if (item) {
      setQueueAction({ event, item });
      return;
    }
    router.push("/queue");
  };

  const mobileListEvents = useMemo(() => {
    const items: CalendarEventItem[] = [];
    for (const { date } of visibleDays) {
      const key = localDayKey(date);
      for (const event of eventsByDay.get(key) ?? []) {
        items.push(event);
      }
    }
    return items;
  }, [visibleDays, eventsByDay]);

  const openEvent = (event: CalendarEventItem) => {
    if (event.pending || event.pendingArchive || event.pendingDelete) {
      openQueueOverlay(event);
      return;
    }
    setSelectedEvent(event);
  };

  const focusDay = (date: Date) => {
    setViewAnchor(new Date(date));
    setViewMode("day");
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = quickAddText.trim();
    if (!text) return;

    if (isDemoUser && !isConnected) {
      if (!tryFeature()) return;

      if (isQuickDeleteIntent(text)) {
        try {
          const parsed = parseQuickDeleteText(text);
          setCustomDemoEvents((prev) =>
            prev.filter(
              (event) =>
                !demoEventMatchesDelete(
                  event.summary ?? "",
                  event.start ?? "",
                  parsed,
                ),
            ),
          );
          setQuickAddText("");
          toast.success("Matching events removed from preview");
        } catch {
          toast.error("Could not parse delete prompt.");
        }
        return;
      }

      try {
        const parsed = parseQuickAddText(text);
        const newEvent: CalendarEventItem = {
          id: `demo-cal-custom-${Date.now()}`,
          summary: parsed.summary,
          start: parsed.startDateTime,
          end: parsed.endDateTime,
          allDay: parsed.allDay,
          location: parsed.allDay ? "All day" : "Virtual",
          attendees: [],
        };
        setCustomDemoEvents((prev) => [...prev, newEvent]);
        setQuickAddText("");
        toast.success(`Event "${parsed.summary}" added to preview`);
      } catch {
        toast.error("Failed to parse prompt. Try 'Lunch tomorrow at noon'");
      }
      return;
    }

    quickAddEvent.mutate({ text });
  };

  const handleCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      let startDateTime: string;
      let endDateTime: string;
      let timeZone: string;
      if (isAllDay) {
        const endExclusive = new Date(`${allDayEnd}T12:00:00`);
        endExclusive.setDate(endExclusive.getDate() + 1);
        const endDateStr = `${endExclusive.getFullYear()}-${String(endExclusive.getMonth() + 1).padStart(2, "0")}-${String(endExclusive.getDate()).padStart(2, "0")}`;
        startDateTime = allDayStart;
        endDateTime = endDateStr;
        timeZone = "UTC";
      } else {
        const when = localDateTimeRangeToPayload(startAt, endAt);
        startDateTime = when.startDateTime;
        endDateTime = when.endDateTime;
        timeZone = when.timeZone;
      }

      if (isDemoUser && !isConnected) {
        if (!tryFeature()) return;

        const newEvent: CalendarEventItem = {
          id: `demo-cal-custom-${Date.now()}`,
          summary,
          start: startDateTime,
          end: endDateTime,
          allDay: isAllDay,
          location: attendee.trim() ? `Meeting with ${attendee.trim()}` : "Virtual",
          attendees: attendee.trim()
            ? [{ email: attendee.trim(), displayName: attendee.trim().split("@")[0] || "Guest", responseStatus: "needsAction" }]
            : [],
        };
        setCustomDemoEvents((prev) => [...prev, newEvent]);
        setShowCreate(false);
        setSummary("");
        setAttendee("");
        toast.success(`Event "${summary}" added to preview`);
        return;
      }

      queueInvite.mutate({
        calendar: {
          summary,
          description: "Scheduled from Thread calendar.",
          startDateTime,
          endDateTime,
          timeZone,
          allDay: isAllDay || undefined,
          attendeeEmails: attendee.trim() ? [attendee.trim()] : undefined,
          recurrence: recurrenceToRrule(recurrenceRule, customRrule),
        },
        title: summary,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please review your dates");
    }
  };

  const handleCheckFreeBusy = (endVal: string) => {
    if (startAt && endVal && isConnected) {
      try {
        const { startDateTime, endDateTime, timeZone } = localDateTimeRangeToPayload(
          startAt,
          endVal,
        );
        checkFreeBusy.mutate({ startDateTime, endDateTime, timeZone });
      } catch {
        // ignore validation errors during typing
      }
    }
  };

  const handleRsvp = (resp: RsvpResponseStatus) => {
    if (!selectedEvent) return;
    if (isDemoUser && !isConnected) {
      const { updatedEvents, updatedEvent } = updateDemoEventRsvp(
        customDemoEvents,
        selectedEvent.id,
        userEmail,
        resp,
      );
      setCustomDemoEvents(updatedEvents);
      if (updatedEvent) setSelectedEvent(updatedEvent);
      toast.success("RSVP updated");
      return;
    }
    respondToEvent.mutate({ eventId: selectedEvent.id, response: resp });
  };

  const handleReschedule = () => {
    if (!selectedEvent) return;
    try {
      const when = selectedEvent.allDay
        ? {
            startDateTime: rescheduleStart || selectedEvent.start?.slice(0, 10) || "",
            endDateTime: rescheduleEnd || selectedEvent.end?.slice(0, 10) || "",
            timeZone: "UTC",
          }
        : localDateTimeRangeToPayload(
            rescheduleStart || isoToLocalDateTimeInput(selectedEvent.start),
            rescheduleEnd || isoToLocalDateTimeInput(selectedEvent.end),
          );
      if (isDemoUser && !isConnected) {
        setCustomDemoEvents((prev) =>
          prev.map((e) =>
            e.id === selectedEvent.id
              ? { ...e, start: when.startDateTime, end: when.endDateTime }
              : e
          )
        );
        setSelectedEvent(null);
        toast.success("Event rescheduled in preview");
        return;
      }

      queueArchive.mutate({
        archive: {
          ...eventToArchivePayload(selectedEvent, { editScope: recurringEditScope }),
          startDateTime: when.startDateTime,
          endDateTime: when.endDateTime,
          timeZone: when.timeZone,
          allDay: selectedEvent.allDay || undefined,
        },
        title: `Reschedule: ${selectedEvent.summary}`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please review your dates");
    }
  };

  const handleDeleteConfirm = () => {
    if (!selectedEvent) return;
    if (isDemoUser && !isConnected) {
      setCustomDemoEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id));
      setSelectedEvent(null);
      setShowDeleteConfirm(false);
      toast.success("Event deleted from preview");
      return;
    }

    queueDelete.mutate({
      delete: eventToDeletePayload(selectedEvent, {
        editScope: recurringEditScope,
      }),
      title: `Delete: ${selectedEvent.summary}`,
    });
  };

  const handleCancelConfirm = () => {
    if (!selectedEvent) return;
    if (isDemoUser && !isConnected) {
      setCustomDemoEvents((prev) => prev.filter((e) => e.id !== selectedEvent.id));
      setSelectedEvent(null);
      setShowCancelConfirm(false);
      toast.success("Cancellation queued in preview");
      return;
    }

    queueDelete.mutate({
      delete: eventToDeletePayload(selectedEvent, {
        cancelWithNotify: true,
        editScope: recurringEditScope,
      }),
      title: `Cancel: ${selectedEvent.summary}`,
    });
  };

  return (
    <div>
      {demoModal}

      <CalendarToolbar
        isConnected={isConnected}
        isDemoUser={isDemoUser}
        connectHref={connectHref}
        quickAddText={quickAddText}
        onQuickAddChange={setQuickAddText}
        onQuickAddSubmit={handleQuickAddSubmit}
        isQuickAddPending={quickAddEvent.isPending}
        onNewInviteClick={() => setShowCreate(true)}
      />

      {banner ? (
        <div
          className="thread-inbox-banner"
          data-variant={banner.type}
          style={{ margin: "12px 0 0" }}
        >
          {banner.text}
        </div>
      ) : null}

      <CalendarHead
        viewMode={viewMode}
        periodLabel={periodLabel}
        onNavigate={(step) => setViewAnchor((current) => navigateAnchor(viewMode, current, step))}
        onViewModeChange={setViewMode}
        onTodayClick={() => {
          setViewAnchor(new Date());
          setViewMode("week");
        }}
        onRefresh={() => void refreshEvents()}
        isFetching={eventsQuery.isFetching}
        eventSearchInput={eventSearchInput}
        onSearchChange={setEventSearchInput}
        dbSearchMode={dbSearchMode}
        onToggleDbSearch={() => setDbSearchMode((v) => !v)}
      />

      <CalendarBody
        eventsLoading={eventsLoading}
        isConnected={isConnected}
        isError={eventsQuery.isError}
        errorMessage={eventsQuery.error?.message}
        onRetry={() => void eventsQuery.refetch()}
        mobileListEvents={mobileListEvents}
        viewMode={viewMode}
        visibleDays={visibleDays}
        eventsByDay={eventsByDay}
        todayKey={todayKey}
        selectedEventId={selectedEvent?.id}
        isDemoUser={isDemoUser}
        onFocusDay={focusDay}
        onOpenEvent={openEvent}
      />

      <CreateEventModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        summary={summary}
        setSummary={setSummary}
        attendee={attendee}
        setAttendee={setAttendee}
        isAllDay={isAllDay}
        setIsAllDay={setIsAllDay}
        allDayStart={allDayStart}
        setAllDayStart={setAllDayStart}
        allDayEnd={allDayEnd}
        setAllDayEnd={setAllDayEnd}
        startAt={startAt}
        setStartAt={setStartAt}
        endAt={endAt}
        setEndAt={setEndAt}
        recurrenceRule={recurrenceRule}
        setRecurrenceRule={setRecurrenceRule}
        customRrule={customRrule}
        setCustomRrule={setCustomRrule}
        conflicts={conflicts}
        isPending={queueInvite.isPending}
        onSubmit={handleCreateSubmit}
        onCheckFreeBusy={handleCheckFreeBusy}
      />

      <EventDetailModal
        selectedEvent={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        eventBusy={eventBusy}
        showPrep={showPrep}
        onTogglePrep={() => setShowPrep((v) => !v)}
        recurringEditScope={recurringEditScope}
        setRecurringEditScope={setRecurringEditScope}
        userEmail={userEmail}
        isRespondPending={respondToEvent.isPending}
        onRsvp={handleRsvp}
        rescheduleStart={rescheduleStart}
        setRescheduleStart={setRescheduleStart}
        rescheduleEnd={rescheduleEnd}
        setRescheduleEnd={setRescheduleEnd}
        onReschedule={handleReschedule}
        isReschedulePending={queueArchive.isPending}
        onOpenCancelConfirm={() => setShowCancelConfirm(true)}
        onOpenDeleteConfirm={() => setShowDeleteConfirm(true)}
      />

      <DeleteConfirmModal
        isOpen={showDeleteConfirm && selectedEvent !== null}
        onClose={() => setShowDeleteConfirm(false)}
        selectedEvent={selectedEvent}
        recurringEditScope={recurringEditScope}
        setRecurringEditScope={setRecurringEditScope}
        isPending={queueDelete.isPending}
        onConfirm={handleDeleteConfirm}
      />

      <CancelConfirmModal
        isOpen={showCancelConfirm && selectedEvent !== null}
        onClose={() => setShowCancelConfirm(false)}
        selectedEvent={selectedEvent}
        recurringEditScope={recurringEditScope}
        setRecurringEditScope={setRecurringEditScope}
        isPending={queueDelete.isPending}
        onConfirm={handleCancelConfirm}
      />

      <QueueActionModal
        queueAction={queueAction}
        isDismissPending={dismissQueueItem.isPending}
        isApprovePending={approveQueueItem.isPending}
        onClose={() => setQueueAction(null)}
        onDismiss={(id) => dismissQueueItem.mutate({ id })}
        onOpenQueue={() => {
          setQueueAction(null);
          router.push("/queue");
        }}
      />
    </div>
  );
}
