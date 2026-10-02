"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Inbox,
  Mail,
  Loader2,
  FilePenLine,
  FileText,
  Archive,
  Tag,
  CalendarPlus,
  ListChecks,
  X,
  Search,
  Sparkles,
  PanelRight,
  Star,
  Zap,
  Trash2,
  BellOff,
  CheckSquare,
  Paperclip,
  Clock,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

import { SmartContextPanel } from "~/components/app/smart-context-panel";
import { PriorityBadge } from "~/components/app/priority-badge";
import { formatPrioritySummary } from "~/lib/priority-display";
import { useDemoAiGuard } from "~/components/app/demo-limit-modal";
import { isDemoLoginEnabled } from "~/lib/demo-config";

import { SenderAvatar } from "~/components/app/sender-avatar";
import { SkeletonList } from "~/components/app/skeleton-list";
import { QueryErrorState } from "~/components/app/query-error-state";
import { EmailMessageBody } from "~/components/app/email-message-body";
import { queueResultMessage } from "~/lib/queue-toast";
import { dismissBriefThreadFromQueueItem } from "~/lib/brief-dismissals";
import { localDateTimeRangeToPayload, toLocalDateTimeInput } from "~/lib/calendar-datetime";
import {
  decodeHtmlEntities,
  displaySender,
  formatListDate,
  formatMessageDate,
  listThreadSubject,
  parseReplyTo,
  replySubject,
  replyTargetForMessage,
  sortThreadsByRank,
} from "~/lib/inbox-display";
import type { RouterOutputs } from "@repo/trpc/client";
import { INBOX_PAGE_SIZE } from "@repo/services/inbox";
import { trpc } from "~/trpc/client";
import { useModalBackdrop } from "~/hooks/use-modal-backdrop";

function threadLikelyHasAttachment(thread: { snippet?: string; subject?: string }) {
  const text = `${thread.subject ?? ""} ${thread.snippet ?? ""}`.toLowerCase();
  return (
    text.includes("attachment") ||
    /\b(pdf|docx|xlsx|pptx|zip|png|jpe?g)\b/.test(text) ||
    /has attached|attached file|sent you a file/.test(text)
  );
}

type InboxView = "inbox" | "priority" | "drafts";
type ThreadRow = RouterOutputs["inbox"]["listThreads"]["threads"][number];
type InboxAnalysis = RouterOutputs["ai"]["rankInboxThreads"];

const PAGE_SIZE = INBOX_PAGE_SIZE;

type OutboundAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  contentBase64: string;
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",")[1]! : result);
    };
    reader.onerror = () => {
      reject(reader.error instanceof Error ? reader.error : new Error("Failed to read file"));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Manual pagination + search accumulator. tRPC's useInfiniteQuery expects a
 * `cursor` field, but our REST-friendly endpoint uses Gmail's native
 * `pageToken`, so we page explicitly and merge results de-duplicated by id.
 *
 * Cache-first: Postgres snapshot paints instantly; live Gmail refresh follows.
 */
function useInboxThreads(query: string, enabled: boolean) {
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [pages, setPages] = useState<{ token: string | undefined; threads: ThreadRow[] }[]>([]);
  const [refreshLive, setRefreshLive] = useState(false);
  const [persistedNextPageToken, setPersistedNextPageToken] = useState<string | undefined>();
  const isFirstPage = pageToken === undefined;

  const cached = trpc.inbox.listCachedThreads.useQuery(
    { limit: PAGE_SIZE, query: query || undefined },
    { enabled: enabled && isFirstPage, staleTime: 60_000 },
  );

  const result = trpc.inbox.listThreads.useQuery(
    {
      maxResults: PAGE_SIZE,
      query: query || undefined,
      pageToken,
      refresh: refreshLive && isFirstPage ? true : undefined,
    },
    {
      enabled,
      refetchInterval: enabled && isFirstPage ? 15_000 : false,
      placeholderData: (prev) => prev,
    },
  );

  useEffect(() => {
    setPageToken(undefined);
    setPages([]);
    setRefreshLive(false);
    setPersistedNextPageToken(undefined);
  }, [query]);

  useEffect(() => {
    if (result.data?.nextPageToken) {
      setPersistedNextPageToken(result.data.nextPageToken);
    }
  }, [result.data?.nextPageToken]);

  useEffect(() => {
    if (result.data?.stale && isFirstPage && !refreshLive) {
      setRefreshLive(true);
    }
  }, [result.data?.stale, isFirstPage, refreshLive]);

  useEffect(() => {
    if (!result.data) {
      return;
    }
    setPages((current) => {
      const existingIndex = current.findIndex((page) => page.token === pageToken);
      if (existingIndex >= 0) {
        if (result.data.stale) {
          return current;
        }
        const next = [...current];
        next[existingIndex] = { token: pageToken, threads: result.data.threads };
        return next;
      }
      return [...current, { token: pageToken, threads: result.data.threads }];
    });
  }, [result.data, pageToken]);

  const threads = useMemo(() => {
    const seen = new Set<string>();
    const merged: ThreadRow[] = [];
    for (const page of pages) {
      for (const thread of page.threads) {
        if (seen.has(thread.id)) {
          continue;
        }
        seen.add(thread.id);
        merged.push(thread);
      }
    }
    if (merged.length > 0) {
      return merged;
    }
    if (isFirstPage && cached.data?.threads.length) {
      return cached.data.threads;
    }
    return [];
  }, [pages, isFirstPage, cached.data?.threads]);

  const nextPageToken = result.data?.nextPageToken ?? persistedNextPageToken;
  const loadMore = useCallback(() => {
    if (nextPageToken) {
      setPageToken(nextPageToken);
    }
  }, [nextPageToken]);

  const hasCachedPreview = isFirstPage && Boolean(cached.data?.threads.length);
  const isLoading = result.isLoading && threads.length === 0;
  const isRefreshing =
    result.isFetching && threads.length > 0 && (refreshLive || result.data?.stale === true);

  return {
    threads,
    nextPageToken,
    loadMore,
    isLoading,
    isError: result.isError && threads.length === 0,
    error: result.error,
    refetch: result.refetch,
    isFetchingMore: result.isFetching && pageToken !== undefined,
    isRefreshing,
    hasCachedPreview,
    dataUpdatedAt: result.dataUpdatedAt,
  };
}

function useDrafts(enabled: boolean) {
  const [pageToken, setPageToken] = useState<string | undefined>(undefined);
  const [pages, setPages] = useState<
    { token: string | undefined; drafts: RouterOutputs["inbox"]["listDrafts"]["drafts"] }[]
  >([]);

  const result = trpc.inbox.listDrafts.useQuery(
    { maxResults: PAGE_SIZE, pageToken },
    { enabled, placeholderData: (prev) => prev },
  );

  useEffect(() => {
    if (!result.data) {
      return;
    }
    setPages((current) => {
      if (current.some((page) => page.token === pageToken)) {
        return current;
      }
      return [...current, { token: pageToken, drafts: result.data.drafts }];
    });
  }, [result.data, pageToken]);

  const drafts = useMemo(() => {
    const seen = new Set<string>();
    const merged: RouterOutputs["inbox"]["listDrafts"]["drafts"] = [];
    for (const page of pages) {
      for (const draft of page.drafts) {
        if (seen.has(draft.id)) {
          continue;
        }
        seen.add(draft.id);
        merged.push(draft);
      }
    }
    return merged;
  }, [pages]);

  const nextPageToken = result.data?.nextPageToken;
  const loadMore = useCallback(() => {
    if (nextPageToken) {
      setPageToken(nextPageToken);
    }
  }, [nextPageToken]);

  return {
    drafts,
    nextPageToken,
    loadMore,
    isLoading: result.isLoading && pages.length === 0,
    isError: result.isError && pages.length === 0,
    error: result.error,
    refetch: result.refetch,
    isFetchingMore: result.isFetching && pageToken !== undefined,
  };
}

type SnoozeOption = "tomorrow" | "nextweek" | "custom";

function getSnoozeDurationMs(when: SnoozeOption, customMs?: number): number {
  const now = Date.now();
  if (when === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(8, 0, 0, 0);
    return d.getTime() - now;
  }
  if (when === "nextweek") {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(8, 0, 0, 0);
    return d.getTime() - now;
  }
  return customMs ?? 86_400_000;
}

function getSnoozeWakeLabel(when: SnoozeOption): string {
  if (when === "tomorrow") {
    return "tomorrow at 8am";
  }
  if (when === "nextweek") {
    return "next week";
  }
  return "later";
}

function loadSnoozedIdsFromStorage(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = localStorage.getItem("thread-snoozed");
    if (!raw) {
      return new Set();
    }
    const entries: Array<{ id: string; until: number }> = JSON.parse(raw);
    const now = Date.now();
    const still = entries.filter((e) => e.until > now);
    if (still.length !== entries.length) {
      localStorage.setItem("thread-snoozed", JSON.stringify(still));
    }
    return new Set(still.map((e) => e.id));
  } catch {
    return new Set();
  }
}

function persistSnoozedThread(threadId: string, until: number): void {
  try {
    const raw = localStorage.getItem("thread-snoozed");
    const existing: Array<{ id: string; until: number }> = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((e) => e.id !== threadId);
    filtered.push({ id: threadId, until });
    localStorage.setItem("thread-snoozed", JSON.stringify(filtered));
  } catch {
    // Ignore storage write issues
  }
}

function removeSnoozedThread(threadId: string): void {
  try {
    const raw = localStorage.getItem("thread-snoozed");
    const existing: Array<{ id: string; until: number }> = raw ? JSON.parse(raw) : [];
    localStorage.setItem("thread-snoozed", JSON.stringify(existing.filter((e) => e.id !== threadId)));
  } catch {
    // Ignore storage write issues
  }
}

type KbdRefState = {
  archiveMutate: (args: { threadId: string }) => void;
  markReadMutate: (args: { threadId: string }) => void;
  starMutate: (args: { threadId: string }) => void;
  unstarMutate: (args: { threadId: string }) => void;
  trashMutate: (args: { threadId: string }) => void;
  snoozeThread: (threadId: string, when: SnoozeOption, customMs?: number) => void;
  clearBulk: () => void;
  starredIds: Set<string>;
  snoozedIds: Set<string>;
  visibleThreads: ThreadRow[];
  selectedId: string | null;
  bulkMode: boolean;
};

function handleListNavKeys(
  e: KeyboardEvent,
  r: KbdRefState,
  onSelectId: (id: string | null) => void,
): boolean {
  if (e.key === "Enter" && !r.selectedId && r.visibleThreads[0]) {
    e.preventDefault();
    onSelectId(r.visibleThreads[0].id);
    return true;
  }
  if ((e.key === "j" || e.key === "ArrowDown") && !r.selectedId) {
    const idx = r.visibleThreads.findIndex((t) => !r.snoozedIds.has(t.id));
    if (idx >= 0) {
      onSelectId(r.visibleThreads[idx]!.id);
    }
    return true;
  }
  if ((e.key === "j" || e.key === "ArrowDown") && r.selectedId) {
    const idx = r.visibleThreads.findIndex((t) => t.id === r.selectedId && !r.snoozedIds.has(t.id));
    const next = r.visibleThreads.slice(idx + 1).find((t) => !r.snoozedIds.has(t.id));
    if (next) {
      onSelectId(next.id);
    }
    return true;
  }
  if ((e.key === "k" || e.key === "ArrowUp") && r.selectedId) {
    const idx = r.visibleThreads.findIndex((t) => t.id === r.selectedId);
    const prev = [...r.visibleThreads].slice(0, idx).reverse().find((t) => !r.snoozedIds.has(t.id));
    if (prev) {
      onSelectId(prev.id);
    }
    return true;
  }
  return false;
}

function handleThreadActionKeys(
  e: KeyboardEvent,
  r: KbdRefState,
  onClearSelected: () => void,
  onToggleBulk: () => void,
): boolean {
  if (e.key === "x" && !r.selectedId) {
    onToggleBulk();
    return true;
  }
  if (!r.selectedId) {
    return false;
  }
  const id = r.selectedId;
  if (e.key === "e") {
    r.archiveMutate({ threadId: id });
    onClearSelected();
    return true;
  }
  if (e.key === "u") {
    r.markReadMutate({ threadId: id });
    return true;
  }
  if (e.key === "s") {
    if (r.starredIds.has(id)) {
      r.unstarMutate({ threadId: id });
    } else {
      r.starMutate({ threadId: id });
    }
    return true;
  }
  if (e.key === "b") {
    r.snoozeThread(id, "tomorrow");
    return true;
  }
  if (e.key === "#") {
    r.trashMutate({ threadId: id });
    onClearSelected();
    return true;
  }
  return false;
}

function getSentimentModifier(sentiment: string | undefined): string {
  if (sentiment === "urgent") {
    return "urgent";
  }
  if (sentiment === "positive") {
    return "positive";
  }
  return "negative";
}

function formatAttachmentSize(size: number): string | null {
  if (size <= 0) {
    return null;
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getEmptyStateText(
  appliedQuery: string,
  view: InboxView,
  hasDemoFixtures: boolean,
): { title: string; subtitle: string | null } {
  if (appliedQuery) {
    return {
      title: "No matches",
      subtitle: `Nothing matched “${appliedQuery}”.`,
    };
  }
  if (view === "priority") {
    return {
      title: "Nothing urgent right now",
      subtitle: "Switch to Inbox to browse all mail.",
    };
  }
  if (hasDemoFixtures) {
    return {
      title: "No threads here",
      subtitle: "Sample threads are on the Inbox tab.",
    };
  }
  return {
    title: "Inbox is empty",
    subtitle: null,
  };
}

function InboxBulkBar({
  bulkSelectedCount,
  onArchive,
  onMarkRead,
  onStar,
  onSnooze,
  onTrash,
  onCancel,
}: Readonly<{
  bulkSelectedCount: number;
  onArchive: () => void;
  onMarkRead: () => void;
  onStar: () => void;
  onSnooze: () => void;
  onTrash: () => void;
  onCancel: () => void;
}>) {
  if (bulkSelectedCount > 0) {
    return (
      <div className="thread-inbox-bulk-bar">
        <span className="thread-inbox-bulk-count">{bulkSelectedCount} selected</span>
        <button type="button" className="thread-inbox-bulk-action" onClick={onArchive}>
          <Archive size={11} /> Archive
        </button>
        <button type="button" className="thread-inbox-bulk-action" onClick={onMarkRead}>
          <Mail size={11} /> Mark read
        </button>
        <button type="button" className="thread-inbox-bulk-action" onClick={onStar}>
          <Star size={11} /> Star
        </button>
        <button type="button" className="thread-inbox-bulk-action" onClick={onSnooze}>
          <BellOff size={11} /> Snooze
        </button>
        <button type="button" className="thread-inbox-bulk-action" onClick={onTrash}>
          <Trash2 size={11} /> Trash
        </button>
        <button type="button" className="thread-inbox-bulk-action thread-inbox-bulk-action--cancel" onClick={onCancel}>
          <X size={11} /> Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="thread-inbox-bulk-bar">
      <span className="thread-inbox-bulk-count" style={{ color: "var(--thread-dim)" }}>Select threads…</span>
      <button type="button" className="thread-inbox-bulk-action thread-inbox-bulk-action--cancel" onClick={onCancel}>
        <X size={11} /> Cancel
      </button>
    </div>
  );
}

function PrioritySummaryBanner({
  isPending,
  priorityAnalysis,
  aiReady,
}: Readonly<{
  isPending: boolean;
  priorityAnalysis: InboxAnalysis | null | undefined;
  aiReady: boolean;
}>) {
  if (isPending) {
    return (
      <span className="thread-priority-summary-loading">
        <Loader2 size={13} className="thread-spin" />
        Analyzing inbox…
      </span>
    );
  }
  if (priorityAnalysis) {
    return (
      <span className="thread-priority-summary-head">
        <Sparkles size={12} style={{ color: "var(--thread-accent-bright)", flexShrink: 0 }} />
        <span>{formatPrioritySummary(priorityAnalysis.summary)}</span>
      </span>
    );
  }
  if (!aiReady) {
    return (
      <span className="thread-priority-summary-meta">
        Priority needs OPENAI_API_KEY or OPENROUTER_API_KEY in server env.
      </span>
    );
  }
  return null;
}

function DraftsList({
  drafts,
  isLoading,
  isError,
  errorMessage,
  selectedId,
  isSending,
  onRetry,
  onSelectDraftThread,
  onEditInCompose,
  onSendDraft,
}: Readonly<{
  drafts: Array<{
    id: string;
    threadId?: string | null;
    to?: string | null;
    subject?: string | null;
    snippet?: string | null;
    updatedAt?: string | Date | null;
  }>;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  selectedId: string | null;
  isSending: boolean;
  onRetry: () => void;
  onSelectDraftThread: (threadId: string) => void;
  onEditInCompose: (draft: { id: string; to?: string | null; subject?: string | null; snippet?: string | null }) => void;
  onSendDraft: (draftId: string) => void;
}>) {
  if (isLoading) return <SkeletonList count={6} />;
  if (isError) {
    return (
      <QueryErrorState
        title="Couldn't load drafts"
        message={errorMessage}
        onRetry={onRetry}
        className="thread-empty-inbox"
      />
    );
  }
  if (drafts.length === 0) {
    return (
      <div className="thread-empty-inbox" style={{ marginTop: 8 }}>
        <FileText size={20} style={{ opacity: 0.35 }} />
        <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--thread-muted)" }}>
          No drafts
        </p>
        <p style={{ marginTop: 6, fontSize: 12, color: "var(--thread-dim)" }}>
          Queue a draft from any thread — approve it to save into Gmail.
        </p>
      </div>
    );
  }
  return (
    <>
      {drafts.map((draft) => (
        <div key={draft.id} className="thread-inbox-row" style={{ display: "block", padding: 0 }}>
          <button
            type="button"
            className="thread-inbox-row"
            style={{ width: "100%", border: "none", background: "transparent" }}
            data-active={Boolean(draft.threadId) && selectedId === draft.threadId}
            onClick={() => {
              if (draft.threadId) {
                onSelectDraftThread(draft.threadId);
              }
            }}
          >
            <span className="thread-inbox-row-line">
              <span className="thread-inbox-row-sender">
                {draft.to ? `To ${draft.to}` : "Draft"}
              </span>
              <span className="thread-inbox-row-date">{formatListDate(draft.updatedAt)}</span>
            </span>
            <span className="thread-inbox-row-subject">
              {draft.subject?.trim() || "(no subject)"}
            </span>
            <span className="thread-inbox-row-snippet">{draft.snippet}</span>
          </button>
          <div style={{ display: "flex", gap: 6, padding: "0 12px 10px" }}>
            <button
              type="button"
              className="thread-btn-ghost"
              style={{ fontSize: 11, padding: "4px 8px" }}
              onClick={() => onEditInCompose(draft)}
            >
              Edit in compose
            </button>
            <button
              type="button"
              className="thread-btn-accent"
              style={{ fontSize: 11, padding: "4px 10px" }}
              disabled={isSending}
              onClick={() => onSendDraft(draft.id)}
              title="Send this draft now"
            >
              {isSending ? "Sending…" : "Send"}
            </button>
            {draft.threadId ? (
              <button
                type="button"
                className="thread-btn-ghost"
                style={{ fontSize: 11, padding: "4px 8px" }}
                onClick={() => onSelectDraftThread(draft.threadId!)}
              >
                Open thread
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </>
  );
}

function LoadMoreButton({
  isFetchingMore,
  onLoadMore,
  label,
}: Readonly<{
  isFetchingMore: boolean;
  onLoadMore: () => void;
  label: string;
}>) {
  return (
    <button
      type="button"
      className="thread-inbox-loadmore"
      onClick={onLoadMore}
      disabled={isFetchingMore}
    >
      {isFetchingMore ? (
        <>
          <Loader2 size={13} className="thread-spin" /> Loading…
        </>
      ) : (
        label
      )}
    </button>
  );
}

function InboxListFooter({
  isRefreshing,
  nextPageToken,
  isFetchingMore,
  onLoadMore,
  count,
}: Readonly<{
  isRefreshing: boolean;
  nextPageToken: string | null | undefined;
  isFetchingMore: boolean;
  onLoadMore: () => void;
  count: number;
}>) {
  if (isRefreshing) {
    return (
      <div className="thread-inbox-list-footer">
        <div className="thread-inbox-sync-dot">
          <Loader2 size={11} className="thread-spin" />
          <span>Syncing…</span>
        </div>
      </div>
    );
  }
  if (nextPageToken) {
    return (
      <div className="thread-inbox-list-footer">
        <LoadMoreButton
          isFetchingMore={isFetchingMore}
          onLoadMore={onLoadMore}
          label="Load more mails"
        />
      </div>
    );
  }
  return (
    <div className="thread-inbox-list-footer">
      <p className="thread-inbox-list-footer-hint">
        All caught up · {count} shown{count >= PAGE_SIZE ? " (scroll list above)" : ""}
      </p>
    </div>
  );
}

function DraftsListFooter({
  nextPageToken,
  isFetchingMore,
  onLoadMore,
}: Readonly<{
  nextPageToken: string | null | undefined;
  isFetchingMore: boolean;
  onLoadMore: () => void;
}>) {
  return (
    <div className="thread-inbox-list-footer">
      {nextPageToken ? (
        <LoadMoreButton
          isFetchingMore={isFetchingMore}
          onLoadMore={onLoadMore}
          label="Load more drafts"
        />
      ) : (
        <p className="thread-inbox-list-footer-hint">All drafts loaded</p>
      )}
    </div>
  );
}

function AiThreadSummaryContent({
  isConnected,
  hasDemoFixtures,
  demoSummarizeEnabled,
  isDemoUser,
  mailDemoState,
  onEnableDemoSummarize,
  isLoading,
  isError,
  data,
  onRetry,
}: Readonly<{
  isConnected: boolean;
  hasDemoFixtures: boolean;
  demoSummarizeEnabled: boolean;
  isDemoUser: boolean;
  mailDemoState: { isExhausted: boolean; remaining: number; limit: number };
  onEnableDemoSummarize: () => void;
  isLoading: boolean;
  isError: boolean;
  data: {
    summary?: string;
    sentiment?: string;
    actionItems?: Array<{ action: string }>;
  } | null | undefined;
  onRetry: () => void;
}>) {
  if (!isConnected && hasDemoFixtures && !demoSummarizeEnabled) {
    const buttonText = isDemoUser && mailDemoState.isExhausted
      ? "Inbox AI limit reached"
      : `Summarize with AI (${mailDemoState.remaining}/${mailDemoState.limit} left)`;
    return (
      <button
        type="button"
        className="thread-btn-ghost"
        style={{ fontSize: 12 }}
        disabled={isDemoUser && mailDemoState.isExhausted}
        onClick={onEnableDemoSummarize}
      >
        <Sparkles size={12} />
        {buttonText}
      </button>
    );
  }
  if (isLoading) {
    return (
      <div className="thread-smart-reply-loading">
        <Sparkles size={11} style={{ color: "var(--thread-accent)" }} className="thread-spin" />
        <span>Summarizing thread…</span>
      </div>
    );
  }
  if (isError) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <p className="thread-smart-reply-label" style={{ color: "#f87171", margin: 0 }}>Summary failed</p>
        <button type="button" onClick={onRetry} style={{ fontSize: 11, color: "var(--thread-accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Retry</button>
      </div>
    );
  }
  if (data) {
    return (
      <>
        <p className="thread-smart-reply-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Sparkles size={11} style={{ color: "var(--thread-accent)" }} />
          AI Summary
          {data.sentiment && data.sentiment !== "neutral" ? (
            <span className={`thread-ai-sentiment thread-ai-sentiment--${getSentimentModifier(data.sentiment)}`}>
              {data.sentiment}
            </span>
          ) : null}
        </p>
        <p className="thread-ai-summary-text">
          {data.summary}
        </p>
        {data.actionItems?.length ? (
          <div className="thread-ai-action-list">
            {data.actionItems.slice(0, 3).map((item) => (
              <span key={item.action} className="thread-ai-action-chip">
                ✓ {item.action}
              </span>
            ))}
          </div>
        ) : null}
      </>
    );
  }
  return null;
}

function SmartRepliesContent({
  isLoading,
  suggestions,
  onPickSuggestion,
}: Readonly<{
  isLoading: boolean;
  suggestions?: Array<{ label: string; body: string }> | null;
  onPickSuggestion: (s: { label: string; body: string }) => void;
}>) {
  if (isLoading) {
    return (
      <div className="thread-smart-reply-loading">
        <Loader2 size={11} className="thread-spin" />
        <span>Generating reply suggestions…</span>
      </div>
    );
  }
  if (suggestions?.length) {
    return (
      <>
        <p className="thread-smart-reply-label">
          <Sparkles size={11} />
          Smart replies — click to use
        </p>
        <div className="thread-smart-reply-chips">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              className="thread-smart-reply-chip"
              onClick={() => onPickSuggestion(s)}
              title={s.body}
            >
              {s.label}
            </button>
          ))}
        </div>
      </>
    );
  }
  return null;
}

function ScheduleMeetingDialog({
  isOpen,
  onClose,
  dialogRef,
  meetingTitle,
  setMeetingTitle,
  replyTo,
  setReplyTo,
  meetingStart,
  setMeetingStart,
  meetingEnd,
  setMeetingEnd,
  replyBody,
  setReplyBody,
  isPending,
  onSubmit,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  meetingTitle: string;
  setMeetingTitle: (val: string) => void;
  replyTo: string;
  setReplyTo: (val: string) => void;
  meetingStart: string;
  setMeetingStart: (val: string) => void;
  meetingEnd: string;
  setMeetingEnd: (val: string) => void;
  replyBody: string;
  setReplyBody: (val: string) => void;
  isPending: boolean;
  onSubmit: (e: React.FormEvent) => void;
}>) {
  if (!isOpen) {
    return null;
  }

  return (
    <dialog ref={dialogRef} open aria-modal="true" className="thread-modal-backdrop">
      <div className="thread-modal">
        <div className="thread-modal-head">
          <h3>Schedule meeting from thread</h3>
          <button type="button" className="thread-app-iconbtn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <form className="thread-modal-form" onSubmit={onSubmit}>
          <label className="thread-set-label" htmlFor="meeting-title">
            Meeting title
          </label>
          <input
            id="meeting-title"
            className="thread-set-input"
            value={meetingTitle}
            onChange={(event) => setMeetingTitle(event.target.value)}
            required
          />

          <label className="thread-set-label" htmlFor="meeting-guest">
            Guest
          </label>
          <input
            id="meeting-guest"
            className="thread-set-input"
            type="email"
            value={replyTo}
            onChange={(event) => setReplyTo(event.target.value)}
            required
          />

          <div className="thread-modal-row">
            <div>
              <label className="thread-set-label" htmlFor="meeting-start">
                Starts
              </label>
              <input
                id="meeting-start"
                className="thread-set-input"
                type="datetime-local"
                value={meetingStart}
                onChange={(event) => setMeetingStart(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="thread-set-label" htmlFor="meeting-end">
                Ends
              </label>
              <input
                id="meeting-end"
                className="thread-set-input"
                type="datetime-local"
                value={meetingEnd}
                onChange={(event) => setMeetingEnd(event.target.value)}
                required
              />
            </div>
          </div>

          <label className="thread-set-label" htmlFor="meeting-email">
            Email message
          </label>
          <textarea
            id="meeting-email"
            className="thread-set-input"
            rows={4}
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
            placeholder="Optional note to send with the invite…"
          />

          <div className="thread-modal-actions">
            <button type="button" className="thread-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="thread-btn-accent" disabled={isPending}>
              <ListChecks size={14} />
              {isPending ? "Queuing…" : "Queue invite + email"}
            </button>
          </div>
          <p className="thread-inbox-compose-note" style={{ margin: 0 }}>
            Goes to the approval queue first. After you approve, it appears on Calendar for the date
            you picked.
          </p>
        </form>
      </div>
    </dialog>
  );
}

function ComposeEmailDialog({
  isOpen,
  onClose,
  dialogRef,
  composeTo,
  setComposeTo,
  composeCc,
  setComposeCc,
  composeBcc,
  setComposeBcc,
  composeSubject,
  setComposeSubject,
  composeBody,
  setComposeBody,
  outboundAttachments,
  onPickAttachments,
  isPending,
  onSend,
  onSaveDraft,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  composeTo: string;
  setComposeTo: (val: string) => void;
  composeCc: string;
  setComposeCc: (val: string) => void;
  composeBcc: string;
  setComposeBcc: (val: string) => void;
  composeSubject: string;
  setComposeSubject: (val: string) => void;
  composeBody: string;
  setComposeBody: (val: string) => void;
  outboundAttachments: OutboundAttachment[];
  onPickAttachments: (files: FileList | null) => void;
  isPending: boolean;
  onSend: (e: React.FormEvent) => void;
  onSaveDraft: () => void;
}>) {
  if (!isOpen) {
    return null;
  }

  return (
    <dialog ref={dialogRef} open aria-modal="true" className="thread-modal-backdrop">
      <div className="thread-modal">
        <div className="thread-modal-head">
          <h3>New message</h3>
          <button
            type="button"
            className="thread-app-iconbtn"
            disabled={isPending}
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>
        <form className="thread-modal-form" onSubmit={onSend}>
          <label className="thread-set-label" htmlFor="compose-to">
            To
          </label>
          <input
            id="compose-to"
            className="thread-set-input"
            type="email"
            value={composeTo}
            onChange={(event) => setComposeTo(event.target.value)}
            required
          />
          <label className="thread-set-label" htmlFor="compose-cc">
            Cc
          </label>
          <input
            id="compose-cc"
            className="thread-set-input"
            type="email"
            value={composeCc}
            onChange={(event) => setComposeCc(event.target.value)}
            placeholder="Optional"
          />
          <label className="thread-set-label" htmlFor="compose-bcc">
            Bcc
          </label>
          <input
            id="compose-bcc"
            className="thread-set-input"
            type="email"
            value={composeBcc}
            onChange={(event) => setComposeBcc(event.target.value)}
            placeholder="Optional"
          />
          <label className="thread-set-label" htmlFor="compose-subject">
            Subject
          </label>
          <input
            id="compose-subject"
            className="thread-set-input"
            value={composeSubject}
            onChange={(event) => setComposeSubject(event.target.value)}
          />
          <label className="thread-set-label" htmlFor="compose-body">
            Message
          </label>
          <textarea
            id="compose-body"
            className="thread-set-input thread-inbox-compose-body"
            rows={8}
            value={composeBody}
            onChange={(event) => setComposeBody(event.target.value)}
            placeholder="Write your message…"
            required
          />
          <label className="thread-set-label" htmlFor="compose-attachments">
            Attachments
          </label>
          <input
            id="compose-attachments"
            type="file"
            multiple
            className="thread-set-input"
            onChange={(event) => { onPickAttachments(event.target.files); }}
          />
          {outboundAttachments.length > 0 && (
            <ul className="thread-inbox-attachment-list" style={{ marginBottom: 8 }}>
              {outboundAttachments.map((att) => (
                <li key={att.id} className="thread-inbox-attachment-item">
                  <FileText size={12} />
                  <span className="thread-inbox-attachment-name">{att.filename}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="thread-modal-actions">
            <button type="button" className="thread-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="thread-btn-ghost"
              disabled={isPending || !composeBody.trim()}
              onClick={onSaveDraft}
            >
              <FilePenLine size={14} />
              Save draft
            </button>
            <button
              type="submit"
              className="thread-btn-accent"
              disabled={isPending || !composeBody.trim()}
            >
              <Mail size={14} />
              {isPending ? "Queuing…" : "Queue send"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}

function InboxListHeader({
  view,
  onViewChange,
  aiReady,
  priorityVisibleCount,
  isConnected,
  isPriorityRanking,
  onPriorityRefresh,
  bulkMode,
  onToggleBulkMode,
  onOpenCompose,
}: Readonly<{
  view: InboxView;
  onViewChange: (view: InboxView) => void;
  aiReady: boolean;
  priorityVisibleCount: number;
  isConnected: boolean;
  isPriorityRanking: boolean;
  onPriorityRefresh: () => void;
  bulkMode: boolean;
  onToggleBulkMode: () => void;
  onOpenCompose: () => void;
}>) {
  return (
    <div className="thread-inbox-list-head">
      <div className="thread-inbox-list-head-tabs">
        <button
          type="button"
          className="thread-inbox-tab"
          data-active={view === "inbox"}
          onClick={() => onViewChange("inbox")}
        >
          Inbox
        </button>
        <button
          type="button"
          className="thread-inbox-tab"
          data-active={view === "priority"}
          onClick={() => onViewChange("priority")}
          title={aiReady ? "Rank by urgency with AI" : "Set OPENAI_API_KEY or OPENROUTER_API_KEY to enable"}
        >
          <Sparkles size={11} />
          Priority
          {priorityVisibleCount > 0 ? (
            <span className="thread-inbox-tab-badge">{priorityVisibleCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          className="thread-inbox-tab"
          data-active={view === "drafts"}
          onClick={() => onViewChange("drafts")}
        >
          Drafts
        </button>
      </div>
      <div className="thread-inbox-list-head-actions">
        {isConnected && (
          <>
            {view === "priority" && aiReady && (
              <button
                type="button"
                className="thread-inbox-priority-refresh-btn"
                onClick={onPriorityRefresh}
                disabled={isPriorityRanking}
                title="Re-analyze inbox priority"
              >
                <RefreshCw size={13} className={isPriorityRanking ? "thread-spin" : undefined} />
              </button>
            )}
            <button
              type="button"
              className={`thread-inbox-bulk-btn${bulkMode ? " thread-inbox-bulk-btn--active" : ""}`}
              onClick={onToggleBulkMode}
              title="Multi-select (x)"
            >
              <CheckSquare size={13} />
            </button>
            <button
              type="button"
              className="thread-inbox-compose-icon-btn"
              onClick={onOpenCompose}
              title="Compose new email"
            >
              <FilePenLine size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function InboxSearchFilterBar({
  isVisible,
  searchInput,
  onSearchInputChange,
  onClearSearch,
  searchRef,
  dbSearchMode,
  onToggleDbSearch,
  appliedQuery,
  onToggleAttachmentFilter,
  labels,
  labelFilter,
  onLabelFilterChange,
}: Readonly<{
  isVisible: boolean;
  searchInput: string;
  onSearchInputChange: (val: string) => void;
  onClearSearch: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  dbSearchMode: boolean;
  onToggleDbSearch: () => void;
  appliedQuery: string;
  onToggleAttachmentFilter: () => void;
  labels?: Array<{ id: string; name: string; type?: string | null }> | null;
  labelFilter: string;
  onLabelFilterChange: (val: string) => void;
}>) {
  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div className="thread-inbox-search">
        <Search size={13} />
        <input
          ref={searchRef}
          type="search"
          value={searchInput}
          onChange={(event) => onSearchInputChange(event.target.value)}
          placeholder={
            dbSearchMode
              ? "Corsair DB search (local cache, sub-second)…"
              : "Search mail (from:, subject:, has:attachment…)"
          }
          aria-label="Search mail"
        />
        <button
          type="button"
          className={`thread-inbox-db-toggle${appliedQuery === "has:attachment" ? " thread-inbox-db-toggle--active" : ""}`}
          onClick={onToggleAttachmentFilter}
          title="Filter threads with attachments (Gmail has:attachment)"
        >
          <Paperclip size={12} />
        </button>
        <button
          type="button"
          className={`thread-inbox-db-toggle${dbSearchMode ? " thread-inbox-db-toggle--active" : ""}`}
          onClick={onToggleDbSearch}
          title="Toggle Corsair DB search (fast local cache)"
        >
          DB
        </button>
        {searchInput ? (
          <button
            type="button"
            className="thread-inbox-search-clear"
            onClick={onClearSearch}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        ) : (
          <kbd className="thread-app-kbd">/</kbd>
        )}
      </div>

      {labels && labels.length > 0 && (
        <div className="thread-inbox-label-filter-row">
          <Tag size={11} />
          <select
            value={labelFilter}
            onChange={(event) => onLabelFilterChange(event.target.value)}
            aria-label="Filter by label"
          >
            <option value="">All labels</option>
            {labels
              .filter((l) => l.type !== "system" || ["STARRED", "IMPORTANT"].includes(l.id))
              .slice(0, 20)
              .map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
          </select>
        </div>
      )}
    </>
  );
}

function InboxPaginationFooter({
  isConnected,
  view,
  visibleThreadCount,
  inboxRefreshing,
  inboxNextPageToken,
  inboxFetchingMore,
  onInboxLoadMore,
  draftsCount,
  draftsNextPageToken,
  draftsFetchingMore,
  onDraftsLoadMore,
}: Readonly<{
  isConnected: boolean;
  view: InboxView;
  visibleThreadCount: number;
  inboxRefreshing: boolean;
  inboxNextPageToken: string | null | undefined;
  inboxFetchingMore: boolean;
  onInboxLoadMore: () => void;
  draftsCount: number;
  draftsNextPageToken: string | null | undefined;
  draftsFetchingMore: boolean;
  onDraftsLoadMore: () => void;
}>) {
  if (!isConnected) {
    return null;
  }
  if (view === "inbox" && visibleThreadCount > 0) {
    return (
      <InboxListFooter
        isRefreshing={inboxRefreshing}
        nextPageToken={inboxNextPageToken}
        isFetchingMore={inboxFetchingMore}
        onLoadMore={onInboxLoadMore}
        count={visibleThreadCount}
      />
    );
  }
  if (view === "drafts" && draftsCount > 0) {
    return (
      <DraftsListFooter
        nextPageToken={draftsNextPageToken}
        isFetchingMore={draftsFetchingMore}
        onLoadMore={onDraftsLoadMore}
      />
    );
  }
  return null;
}

export default function InboxPage() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<InboxView>("inbox");
  const [priorityAnalysis, setPriorityAnalysis] = useState<InboxAnalysis | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [dbSearchMode, setDbSearchMode] = useState(false);
  const [mutedThreadIds, setMutedThreadIds] = useState<Set<string>>(() => new Set());
  const priorityBootstrapped = useRef(false);
  const lastRankedKeyRef = useRef("");
  const [replyTo, setReplyTo] = useState("");
  const [replySubjectValue, setReplySubjectValue] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyCc, setReplyCc] = useState("");
  const [replyBcc, setReplyBcc] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingStart, setMeetingStart] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 86_400_000)),
  );
  const [meetingEnd, setMeetingEnd] = useState(() =>
    toLocalDateTimeInput(new Date(Date.now() + 86_400_000 + 3_600_000)),
  );
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(new Set());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const labelPickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showLabelPicker) {
      return;
    }
    function handleClickOutside(e: MouseEvent) {
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setShowLabelPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showLabelPicker]);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [outboundAttachments, setOutboundAttachments] = useState<OutboundAttachment[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Snooze (localStorage) ──────────────────────────────────────────────────
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(loadSnoozedIdsFromStorage);

  const snoozeThread = useCallback((threadId: string, when: "tomorrow" | "nextweek" | "custom", customMs?: number) => {
    const now = Date.now();
    const ms = getSnoozeDurationMs(when, customMs);
    const until = now + ms;
    setSnoozedIds((prev) => {
      const next = new Set(prev);
      next.add(threadId);
      persistSnoozedThread(threadId, until);
      return next;
    });
    if (selectedId === threadId) {
      setSelectedId(null);
    }
    const wakeLabel = getSnoozeWakeLabel(when);
    toast.success(`Snoozed until ${wakeLabel}`, {
      action: { label: "Undo", onClick: () => unsnoozeThread(threadId) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const unsnoozeThread = useCallback((threadId: string) => {
    setSnoozedIds((prev) => {
      const next = new Set(prev);
      next.delete(threadId);
      removeSnoozedThread(threadId);
      return next;
    });
  }, []);

  // ── Bulk select ────────────────────────────────────────────────────────────
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  const toggleBulk = useCallback((id: string) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearBulk = useCallback(() => {
    setBulkMode(false);
    setBulkSelected(new Set());
  }, []);

  const utils = trpc.useUtils();

  const bulkArchive = useCallback(async () => {
    const ids = [...bulkSelected];
    clearBulk();
    await utils.client.inbox.batchModifyThreads.mutate({
      threadIds: ids,
      removeLabelIds: ["INBOX"],
    });
    toast.success(`${ids.length} thread${ids.length === 1 ? "" : "s"} archived`);
    await utils.inbox.listThreads.invalidate();
  }, [bulkSelected, clearBulk, utils]);

  const bulkMarkRead = useCallback(async () => {
    const ids = [...bulkSelected];
    clearBulk();
    await utils.client.inbox.batchModifyThreads.mutate({
      threadIds: ids,
      removeLabelIds: ["UNREAD"],
    });
    toast.success(`${ids.length} thread${ids.length === 1 ? "" : "s"} marked read`);
    await utils.inbox.listThreads.invalidate();
  }, [bulkSelected, clearBulk, utils]);

  const bulkSnooze = useCallback(() => {
    for (const id of bulkSelected) {
      snoozeThread(id, "tomorrow");
    }
    toast.dismiss();
    toast.success(`${bulkSelected.size} thread${bulkSelected.size === 1 ? "" : "s"} snoozed until tomorrow`);
    clearBulk();
  }, [bulkSelected, snoozeThread, clearBulk]);

  const bulkStar = useCallback(async () => {
    const ids = [...bulkSelected];
    clearBulk();
    await utils.client.inbox.batchModifyThreads.mutate({
      threadIds: ids,
      addLabelIds: ["STARRED"],
    });
    toast.success(`${ids.length} thread${ids.length === 1 ? "" : "s"} starred`);
    await utils.inbox.listThreads.invalidate();
  }, [bulkSelected, clearBulk, utils]);

  const bulkTrash = useCallback(async () => {
    const ids = [...bulkSelected];
    clearBulk();
    await Promise.all(ids.map((id) => utils.client.inbox.trashThread.mutate({ threadId: id })));
    toast.success(`${ids.length} thread${ids.length === 1 ? "" : "s"} moved to trash`);
    await utils.inbox.listThreads.invalidate();
  }, [bulkSelected, clearBulk, utils]);
  const meQuery = trpc.auth.me.useQuery({});
  const userEmail = meQuery.data?.email;
  const userPhotoUrl = meQuery.data?.profileImageUrl;
  const statusQuery = trpc.inbox.connectionStatus.useQuery({});
  const calendarStatus = trpc.calendar.connectionStatus.useQuery({});
  const aiStatus = trpc.ai.status.useQuery({});
  const aiReady = aiStatus.data?.openai === true;

  const isConnected = statusQuery.data?.gmail === "connected";
  const { isDemo: isDemoUser, tryFeature: tryMailDemo, modal: mailDemoModal, featureState: mailDemoState } =
    useDemoAiGuard(userEmail, "mail");
  const [demoSummarizeEnabled, setDemoSummarizeEnabled] = useState(false);
  const demoCacheQuery = trpc.inbox.listCachedThreads.useQuery({ limit: 50 }, { staleTime: 120_000 });
  const hasDemoFixtures =
    (isDemoUser || isDemoLoginEnabled()) && !isConnected;
  const canBrowseInbox = isConnected || hasDemoFixtures;

  const approveQueueItem = trpc.queue.approve.useMutation({
    onSuccess: async () => {
      await utils.queue.pendingCount.invalidate();
      await utils.queue.list.invalidate();
      toast.success("Approved and sent");
    },
    onError: (error) => toast.error(error.message),
  });

  const markRead = trpc.inbox.markThreadRead.useMutation({
    onSuccess: (_data, variables) => {
      // Optimistically flip unread=false in the cached thread list.
      utils.inbox.listThreads.setData(
        { maxResults: PAGE_SIZE, query: appliedQuery || undefined },
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            threads: old.threads.map((t) =>
              t.id === variables.threadId ? { ...t, unread: false } : t,
            ),
          };
        },
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [importantIds, setImportantIds] = useState<Set<string>>(new Set());

  const starThread = trpc.inbox.starThread.useMutation({
    onSuccess: () => {
      if (selectedId) {
        setStarredIds((s) => new Set([...s, selectedId]));
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const unstarThread = trpc.inbox.unstarThread.useMutation({
    onSuccess: () => {
      if (selectedId) {
        setStarredIds((s) => {
          const n = new Set(s);
          n.delete(selectedId);
          return n;
        });
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const markImportant = trpc.inbox.markImportant.useMutation({
    onSuccess: () => {
      if (selectedId) {
        setImportantIds((s) => new Set([...s, selectedId]));
        toast.success("Marked as important");
      }
    },
    onError: (e) => toast.error(e.message),
  });
  const markNotImportant = trpc.inbox.markNotImportant.useMutation({
    onSuccess: () => {
      if (selectedId) {
        setImportantIds((s) => {
          const n = new Set(s);
          n.delete(selectedId);
          return n;
        });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const removeThreadFromList = (threadId: string) => {
    utils.inbox.listThreads.setData(
      { maxResults: PAGE_SIZE, query: appliedQuery || undefined },
      (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          threads: old.threads.filter((t) => t.id !== threadId),
        };
      },
    );
    setSelectedId(null);
  };

  const trashThread = trpc.inbox.trashThread.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Moved to trash");
      removeThreadFromList(variables.threadId);
    },
    onError: (e) => toast.error(e.message),
  });

  const muteThread = trpc.inbox.muteThread.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Thread muted");
      setMutedThreadIds((prev) => new Set(prev).add(variables.threadId));
      removeThreadFromList(variables.threadId);
    },
    onError: (e) => toast.error(e.message),
  });

  const unmuteThread = trpc.inbox.unmuteThread.useMutation({
    onSuccess: (_data, variables) => {
      toast.success("Thread unmuted");
      setMutedThreadIds((prev) => {
        const next = new Set(prev);
        next.delete(variables.threadId);
        return next;
      });
      void utils.inbox.listThreads.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendDraft = trpc.queue.enqueueDraftSend.useMutation({
    onSuccess: async (item) => {
      toast.success(queueResultMessage(item).title);
      await utils.queue.pendingCount.invalidate();
      await utils.queue.list.invalidate();
      await utils.inbox.listDrafts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const archiveThread = trpc.inbox.archiveThread.useMutation({
    onSuccess: (_data, variables) => {
      removeThreadFromList(variables.threadId);
      toast.success("Thread archived");
    },
    onError: (error) => toast.error(error.message),
  });

  const labelsQuery = trpc.inbox.listLabels.useQuery({}, {
    staleTime: 5 * 60_000,
    enabled: isConnected,
  });

  const applyLabel = trpc.inbox.applyLabel.useMutation({
    onSuccess: () => toast.success("Label applied"),
    onError: (e) => toast.error(e.message),
  });

  const removeLabel = trpc.inbox.removeLabel.useMutation({
    onSuccess: () => toast.success("Label removed"),
    onError: (e) => toast.error(e.message),
  });

  const createLabel = trpc.inbox.createLabel.useMutation({
    onSuccess: async (label) => {
      toast.success(`Label "${label.name}" created`);
      setNewLabelName("");
      await utils.inbox.listLabels.invalidate();
      if (selectedId) {
        applyLabel.mutate({ threadId: selectedId, labelId: label.id });
      }
      setShowLabelPicker(false);
    },
    onError: (e) => toast.error(e.message),
  });

  // Debounce the search box so each keystroke doesn't hit Gmail.
  useEffect(() => {
    const id = window.setTimeout(() => setAppliedQuery(searchInput.trim()), 350);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    if (searchParams.get("focus") === "search") {
      setView("inbox");
      window.setTimeout(() => searchRef.current?.focus(), 50);
    }
    if (searchParams.get("compose") === "1") {
      setView("inbox");
      setShowCompose(true);
    }
    const threadId = searchParams.get("thread");
    if (threadId) {
      setView("inbox");
      setSelectedId(threadId);
    }
  }, [searchParams]);

  const effectiveQuery = useMemo(() => {
    const parts: string[] = [];
    if (appliedQuery) {
      parts.push(appliedQuery);
    }
    if (labelFilter) {
      const label = labelsQuery.data?.find((entry) => entry.id === labelFilter);
      if (label?.name) {
        parts.push(label.name.includes(" ") ? `label:"${label.name}"` : `label:${label.name}`);
      }
    }
    return parts.join(" ").trim();
  }, [appliedQuery, labelFilter, labelsQuery.data]);

  const inbox = useInboxThreads(effectiveQuery, isConnected && !dbSearchMode);
  const dbSearch = trpc.inbox.searchThreadsDb.useQuery(
    { query: appliedQuery || undefined, limit: PAGE_SIZE },
    { enabled: isConnected && dbSearchMode && view === "inbox", staleTime: 30_000 },
  );
  const threads = useMemo(() => {
    return dbSearchMode && view === "inbox" ? (dbSearch.data?.threads ?? []) : inbox.threads;
  }, [dbSearchMode, view, dbSearch.data?.threads, inbox.threads]);

  const displayThreads = useMemo(() => {
    return hasDemoFixtures ? (demoCacheQuery.data?.threads ?? []) : threads;
  }, [hasDemoFixtures, demoCacheQuery.data?.threads, threads]);

  const drafts = useDrafts(isConnected && view === "drafts");

  const selectedQuery = trpc.inbox.getThread.useQuery(
    { threadId: selectedId ?? "" },
    { enabled: Boolean(selectedId) && (isConnected || hasDemoFixtures) },
  );

  // Detect meeting invites in the selected thread and search for the matching
  // calendar event so we can RSVP with the real Google Calendar event ID.
  const rsvpIsInvite = useMemo(() => {
    const msgs = selectedQuery.data?.messages ?? [];
    const allText = msgs.map((m) => (m.body ?? "") + (m.snippet ?? "")).join(" ");
    return /you.?re? invited|calendar invite|rsvp|join.*meeting|google meet|zoom\.us\/j\//i.test(allText);
  }, [selectedQuery.data?.messages]);

  const rsvpSearchTerm = useMemo(() => {
    if (!selectedQuery.data?.subject) {
      return "";
    }
    return selectedQuery.data.subject.replace(/^(Re|Fwd|FW|RE|FWD):\s*/i, "").trim();
  }, [selectedQuery.data?.subject]);

  const selectedAttachmentCount = useMemo(() => {
    const msgs = selectedQuery.data?.messages ?? [];
    return msgs.reduce((sum, m) => sum + (m.attachments?.length ?? 0), 0);
  }, [selectedQuery.data?.messages]);

  // Stable time range computed once — events in the next 45 days.
  const rsvpTimeRange = useMemo(() => ({
    timeMin: new Date().toISOString(),
    timeMax: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [selectedId]); // re-compute when thread changes, not on every render

  const rsvpEventQuery = trpc.calendar.listEvents.useQuery(
    { ...rsvpTimeRange, q: rsvpSearchTerm, maxResults: 5 },
    {
      enabled: Boolean(rsvpIsInvite && rsvpSearchTerm && calendarStatus.data?.googlecalendar === "connected"),
      staleTime: 60_000,
    },
  );

  const rsvpEvent = rsvpEventQuery.data?.events[0] ?? null;

  const queueEmail = trpc.queue.enqueueEmail.useMutation({
    onSuccess: async (item) => {
      dismissBriefThreadFromQueueItem(item);
      await utils.queue.pendingCount.invalidate();
      await utils.ai.dailyBrief.invalidate();
      const msg = queueResultMessage(item);
      if (item.status === "pending") {
        toast.success(msg.title, {
          action: {
            label: "Approve",
            onClick: () => approveQueueItem.mutate({ id: item.id }),
          },
        });
      } else {
        toast.success(msg.title);
      }
      setReplyBody("");
      setReplyCc("");
      setReplyBcc("");
      setShowCompose(false);
      setComposeTo("");
      setComposeCc("");
      setComposeBcc("");
      setComposeSubject("");
      setComposeBody("");
      setOutboundAttachments([]);
    },
    onError: (error) => toast.error(error.message),
  });

  const scheduleDialogRef = useModalBackdrop(showSchedule, () => setShowSchedule(false));
  const composeDialogRef = useModalBackdrop(showCompose, () => setShowCompose(false), queueEmail.isPending);

  const rankThreads = trpc.ai.rankInboxThreads.useMutation({
    onSuccess: (result) => {
      setPriorityAnalysis(result);
    },
    onError: (error) => toast.error(error.message),
  });

  const refreshPriorityRank = useCallback(
    async (opts?: { force?: boolean; query?: string }) => {
      if (!isConnected || !aiReady) {
        return;
      }
      try {
        const defaultRankQuery = [
          effectiveQuery,
          "-category:promotions -category:social -category:forums",
        ]
          .filter(Boolean)
          .join(" ");
        const rankQuery = opts?.query ?? (defaultRankQuery || undefined);
        const batch = await utils.client.inbox.listThreads.query({
          maxResults: 50,
          query: rankQuery,
          refresh: opts?.force ?? true,
        });
        if (batch.threads.length === 0) {
          setPriorityAnalysis(null);
          lastRankedKeyRef.current = "";
          return;
        }
        const slice = batch.threads.slice(0, 40);
        const key = slice.map((thread) => thread.id).join(",");
        if (!opts?.force && key === lastRankedKeyRef.current && priorityAnalysis) {
          return;
        }
        lastRankedKeyRef.current = key;
        rankThreads.mutate({
          threads: slice.map((thread) => ({
            id: thread.id,
            snippet: thread.snippet,
            subject: thread.subject,
            from: thread.fromName ?? thread.from,
          })),
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load threads for ranking");
      }
    },
    [aiReady, effectiveQuery, isConnected, priorityAnalysis, rankThreads, utils.client.inbox.listThreads],
  );

  const priorityByThreadId = useMemo(() => {
    const map = new Map<string, InboxAnalysis["items"][number]>();
    for (const item of priorityAnalysis?.items ?? []) {
      map.set(item.id, item);
    }
    return map;
  }, [priorityAnalysis]);

  const queueMeeting = trpc.queue.enqueueMeeting.useMutation({
    onSuccess: async (item) => {
      await utils.queue.pendingCount.invalidate();
      await utils.queue.list.invalidate();
      setShowSchedule(false);
      const msg = queueResultMessage(item);
      if (msg.queued) {
        toast.success(msg.title, {
          action: {
            label: "Open Queue",
            onClick: () => {
              window.location.href = "/queue";
            },
          },
        });
      } else {
        toast.success(msg.title);
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const calendarConnected = calendarStatus.data?.googlecalendar === "connected";

  useEffect(() => {
    if (!isConnected || !aiReady || priorityBootstrapped.current) {
      return;
    }
    priorityBootstrapped.current = true;
    void refreshPriorityRank({ force: true });
  }, [isConnected, aiReady, refreshPriorityRank]);

  const smartRepliesQuery = trpc.ai.smartReplies.useQuery(
    { threadId: selectedId ?? "" },
    {
      enabled: Boolean(selectedId) && aiReady && (isConnected || demoSummarizeEnabled),
      staleTime: 2 * 60_000,
    },
  );

  const summarizeQuery = trpc.ai.summarizeThread.useQuery(
    { threadId: selectedId ?? "" },
    {
      enabled: Boolean(selectedId) && aiReady && (isConnected || demoSummarizeEnabled),
      staleTime: 5 * 60_000,
    },
  );

  const visibleThreads = useMemo(() => {
    const source = hasDemoFixtures ? displayThreads : threads;
    if (view !== "priority") {
      return source;
    }

    const rankedIds = priorityAnalysis?.rankedIds;
    if (!rankedIds?.length) {
      return [];
    }
    const rankedSet = new Set(rankedIds);
    const filtered = source.filter((t) => {
      if (!rankedSet.has(t.id)) {
        return false;
      }
      const item = priorityByThreadId.get(t.id);
      return item?.urgency !== "noise";
    });
    return sortThreadsByRank(filtered, rankedIds);
  }, [threads, displayThreads, hasDemoFixtures, view, priorityAnalysis, priorityByThreadId]);

  const priorityVisibleCount = useMemo(() => {
    if (!priorityAnalysis) {
      return 0;
    }
    return priorityAnalysis.items.filter((item) => item.urgency !== "noise").length;
  }, [priorityAnalysis]);

  const priorityRanking = rankThreads.isPending;
  const priorityReady = Boolean(priorityAnalysis?.rankedIds?.length);

  // If user is on Priority but analysis is missing, re-fetch (e.g. after navigation).
  useEffect(() => {
    if (view !== "priority" || priorityReady || priorityRanking || !isConnected || !aiReady) {
      return;
    }
    void refreshPriorityRank({ force: true });
  }, [view, priorityReady, priorityRanking, isConnected, aiReady, refreshPriorityRank]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  // Keep latest action fns in a ref so the keydown listener never needs to be
  // torn down and re-registered when mutation state (isPending, etc.) changes.
  const getKbdActions = () => ({
    archiveMutate: archiveThread.mutate,
    markReadMutate: markRead.mutate,
    starMutate: starThread.mutate,
    unstarMutate: unstarThread.mutate,
    trashMutate: trashThread.mutate,
    snoozeThread,
    clearBulk,
    starredIds,
    snoozedIds,
    visibleThreads,
    selectedId,
    bulkMode,
  });
  const kbdRef = useRef(getKbdActions());
  useEffect(() => {
    kbdRef.current = getKbdActions();
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const r = kbdRef.current;
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (e.key === "Escape") {
        if (r.bulkMode) {
          r.clearBulk();
          return;
        }
        if (r.selectedId) {
          setSelectedId(null);
          return;
        }
        setSearchInput("");
        return;
      }
      if (isEditing) {
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (
        handleThreadActionKeys(
          e,
          r,
          () => setSelectedId(null),
          () => {
            setBulkMode((v) => {
              if (v) {
                r.clearBulk();
              }
              return !v;
            });
          },
        )
      ) {
        return;
      }
      handleListNavKeys(e, r, setSelectedId);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // registered once — reads latest state from kbdRef

  const handleViewChange = (nextView: InboxView) => {
    setView(nextView);
    if (nextView !== "priority") {
      return;
    }
    if (hasDemoFixtures && !isConnected) {
      return;
    }
    if (!aiReady) {
      toast.message("Add OPENAI_API_KEY or OPENROUTER_API_KEY to enable AI priority ranking.");
      return;
    }
    if (!priorityAnalysis?.rankedIds?.length && !rankThreads.isPending) {
      void refreshPriorityRank({ force: true });
    }
  };

  const handlePriorityRefresh = () => {
    if (!aiReady) {
      toast.message("Add OPENAI_API_KEY or OPENROUTER_API_KEY to enable AI priority ranking.");
      return;
    }
    void refreshPriorityRank({ force: true });
  };

  const banner = useMemo(() => {
    const gmailConnected = searchParams.get("gmail") === "connected";
    const error = searchParams.get("error");
    if (gmailConnected) {
      return { type: "success" as const, text: "Gmail connected successfully." };
    }
    if (error) {
      return { type: "error" as const, text: error };
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (view === "drafts") {
      return;
    }
    if (!selectedId && visibleThreads.length > 0) {
      setSelectedId(visibleThreads[0]?.id ?? null);
    }
  }, [visibleThreads, selectedId, view]);

  useEffect(() => {
    if (searchParams.get("gmail") === "connected") {
      void utils.inbox.connectionStatus.invalidate();
    }
  }, [searchParams, utils]);

  /** Sync starred/important toggle state from Gmail label IDs. */
  const syncLabelState = (id: string, labelIds: string[]) => {
    if (labelIds.includes("STARRED")) {
      setStarredIds((s) => new Set([...s, id]));
    } else {
      setStarredIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
    if (labelIds.includes("IMPORTANT")) {
      setImportantIds((s) => new Set([...s, id]));
    } else {
      setImportantIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  useEffect(() => {
    if (!selectedQuery.data) {
      return;
    }
    // Mark the thread as read when it's opened and it's currently unread.
    const thread = visibleThreads.find((t) => t.id === selectedId);
    if (thread?.unread && selectedId && isConnected) {
      markRead.mutate({ threadId: selectedId });
    }
    // Initialize star/important state from Gmail labelIds (via Corsair)
    if (selectedId && selectedQuery.data.labelIds) {
      syncLabelState(selectedId, selectedQuery.data.labelIds);
    }
    const messages = selectedQuery.data.messages ?? [];
    const last = messages.at(-1);
    const lastId = last?.id ?? null;
    let initialReplyTo = selectedQuery.data.suggestedReplyTo?.trim() || parseReplyTo(selectedQuery.data.from);
    if (last) {
      const target = replyTargetForMessage(last, userEmail);
      if (target) {
        initialReplyTo = target;
      }
    }
    setReplyTo(initialReplyTo);
    setReplySubjectValue(replySubject(selectedQuery.data.subject));
    setReplyBody("");
    setMeetingTitle(
      selectedQuery.data.subject?.trim() ? `Sync: ${selectedQuery.data.subject}` : "Meeting",
    );
    setActiveMessageId(lastId);
    if (lastId) {
      setExpandedMessageIds(new Set([lastId]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuery.data, userEmail]);

  const threadMessages = selectedQuery.data?.messages ?? [];

  const handleMessageClick = (message: (typeof threadMessages)[number]) => {
    setActiveMessageId(message.id);
    setReplyTo(replyTargetForMessage(message, userEmail));
    setExpandedMessageIds((current) => {
      const next = new Set(current);
      if (next.has(message.id)) {
        next.delete(message.id);
      } else {
        next.add(message.id);
      }
      return next;
    });
  };

  useEffect(() => {
    setDemoSummarizeEnabled(false);
  }, [selectedId]);

  const connectHref = `/api-connect/gmail?state=${encodeURIComponent("/inbox")}`;

  const emailPayload = {
    to: replyTo,
    cc: replyCc.trim() || undefined,
    bcc: replyBcc.trim() || undefined,
    subject: replySubjectValue,
    body: replyBody,
    threadId: selectedQuery.data?.id,
    attachments: outboundAttachments.length
      ? outboundAttachments.map(({ filename, mimeType, contentBase64 }) => ({
          filename,
          mimeType,
          contentBase64,
        }))
      : undefined,
  };

  const pickAttachments = async (files: FileList | null) => {
    if (!files) {
      return;
    }
    const availableSlots = Math.max(0, 5 - outboundAttachments.length);
    const filesToProcess = Array.from(files).slice(0, availableSlots);
    const newAttachments = await Promise.all(
      filesToProcess.map(async (file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        contentBase64: await fileToBase64(file),
      })),
    );
    setOutboundAttachments((current) => [...current, ...newAttachments]);
  };

  const removeOutboundAttachment = useCallback((id: string) => {
    setOutboundAttachments((current) => current.filter((item) => item.id !== id));
  }, []);

  const handleScheduleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const when = localDateTimeRangeToPayload(meetingStart, meetingEnd);
      queueMeeting.mutate({
        email: {
          ...emailPayload,
          body:
            replyBody.trim() ||
            `Looking forward to our meeting about ${meetingTitle}. Calendar invite attached.`,
          subject: `Meeting: ${meetingTitle}`,
        },
        calendar: {
          summary: meetingTitle,
          description: `Scheduled from Thread inbox thread.`,
          startDateTime: when.startDateTime,
          endDateTime: when.endDateTime,
          timeZone: when.timeZone,
          attendeeEmails: replyTo.trim() ? [replyTo.trim()] : undefined,
        },
        sourceThreadId: selectedQuery.data?.id,
        title: `Meeting with ${replyTo || "guest"}`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Please review your dates");
    }
  };

  const handleComposeSend = (event: React.FormEvent) => {
    event.preventDefault();
    if (!composeTo.trim() || !composeBody.trim()) {
      return;
    }
    queueEmail.mutate({
      mode: "send",
      email: {
        to: composeTo.trim(),
        subject: composeSubject.trim() || "(no subject)",
        body: composeBody,
        cc: composeCc.trim() || undefined,
        bcc: composeBcc.trim() || undefined,
        attachments: outboundAttachments.length
          ? outboundAttachments.map(({ filename, mimeType, contentBase64 }) => ({
              filename,
              mimeType,
              contentBase64,
            }))
          : undefined,
      },
      title: `Send: ${composeSubject.trim() || "(no subject)"}`,
    });
  };

  const handleComposeSaveDraft = () => {
    queueEmail.mutate({
      mode: "draft",
      email: {
        to: composeTo.trim(),
        subject: composeSubject.trim() || "(no subject)",
        body: composeBody,
        attachments: outboundAttachments.length
          ? outboundAttachments.map(({ filename, mimeType, contentBase64 }) => ({
              filename,
              mimeType,
              contentBase64,
            }))
          : undefined,
      },
      title: "New draft",
    });
  };

  const handleToggleAttachmentFilter = () => {
    if (appliedQuery === "has:attachment") {
      setSearchInput("");
      setAppliedQuery("");
    } else {
      setSearchInput("has:attachment");
      setAppliedQuery("has:attachment");
    }
  };

  const handleToggleBulkMode = () => {
    setBulkMode((v) => {
      if (v) {
        clearBulk();
      }
      return !v;
    });
  };

  const renderListBody = () => {
    if (statusQuery.isLoading) {
      return (
        <div className="thread-empty-inbox" style={{ marginTop: 8 }}>
          <Loader2 size={18} className="thread-spin" />
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--thread-dim)" }}>
            Checking Gmail…
          </p>
        </div>
      );
    }
    if (!canBrowseInbox) {
      return (
        <div className="thread-empty-inbox" style={{ marginTop: 8 }}>
          <Inbox size={20} style={{ opacity: 0.35 }} />
          <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--thread-muted)" }}>
            No threads yet
          </p>
          <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: "var(--thread-dim)" }}>
            Connect Gmail via Corsair to sync your inbox here, or use demo login for sample threads.
          </p>
          <a
            href={connectHref}
            className="thread-btn-primary"
            style={{ marginTop: 14, fontSize: 12, padding: "8px 14px", display: "inline-flex" }}
          >
            Connect Gmail
          </a>
        </div>
      );
    }
    if (view === "drafts") {
      return (
        <DraftsList
          drafts={drafts.drafts}
          isLoading={drafts.isLoading}
          isError={drafts.isError}
          errorMessage={drafts.error?.message}
          selectedId={selectedId}
          isSending={sendDraft.isPending}
          onRetry={() => void drafts.refetch()}
          onSelectDraftThread={(threadId) => {
            setView("inbox");
            setSelectedId(threadId);
          }}
          onEditInCompose={async (draft) => {
            setComposeTo(draft.to ?? "");
            setComposeSubject(draft.subject ?? "");
            setComposeBody(draft.snippet ?? "");
            try {
              const full = await utils.client.inbox.getDraft.query({ draftId: draft.id });
              if (full?.body) {
                setComposeBody(full.body);
              }
              if (full?.subject) {
                setComposeSubject(full.subject);
              }
              if (full?.to) {
                setComposeTo(full.to);
              }
            } catch {
              // fall back to snippet metadata
            }
            setOutboundAttachments([]);
            setShowCompose(true);
            setView("inbox");
          }}
          onSendDraft={(draftId) => sendDraft.mutate({ draftId })}
        />
      );
    }
    if (view === "priority" && hasDemoFixtures && !isConnected) {
      return (
        <div className="thread-empty-inbox" style={{ marginTop: 8 }}>
          <Sparkles size={20} style={{ opacity: 0.35 }} />
          <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--thread-muted)" }}>
            Priority needs Gmail
          </p>
          <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: "var(--thread-dim)" }}>
            AI priority ranking isn&apos;t part of the demo walkthrough. Your {demoCacheQuery.data?.threads.length ?? 0} sample threads are on the Inbox tab.
          </p>
          <button
            type="button"
            className="thread-btn-accent"
            style={{ marginTop: 14, fontSize: 12, padding: "8px 14px" }}
            onClick={() => setView("inbox")}
          >
            Go to Inbox
          </button>
        </div>
      );
    }
    if (view === "priority" && !priorityReady && isConnected && aiReady) {
      return <SkeletonList count={8} />;
    }
    if (inbox.isLoading) {
      return <SkeletonList count={10} />;
    }
    if (inbox.isError) {
      return (
        <QueryErrorState
          title="Couldn't load inbox"
          message={inbox.error?.message}
          onRetry={() => void inbox.refetch()}
          className="thread-empty-inbox"
        />
      );
    }
    if (visibleThreads.length === 0) {
      const emptyState = getEmptyStateText(appliedQuery, view, hasDemoFixtures);
      return (
        <div className="thread-empty-inbox" style={{ marginTop: 8 }}>
          <Inbox size={20} style={{ opacity: 0.35 }} />
          <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--thread-muted)" }}>
            {emptyState.title}
          </p>
          {emptyState.subtitle ? (
            <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.55, color: "var(--thread-dim)" }}>
              {emptyState.subtitle}
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <>
        {visibleThreads.map((thread) => {
          const priority =
            view === "priority" && priorityAnalysis
              ? priorityByThreadId.get(thread.id)
              : undefined;
          const isSnoozed = snoozedIds.has(thread.id);
          if (isSnoozed) {
            return null;
          }
          const isSelected = selectedId === thread.id;
          const isChecked = bulkSelected.has(thread.id);
          return (
            <div
              key={thread.id}
              className="thread-inbox-row-wrap"
              data-active={isSelected}
              data-checked={isChecked}
              data-priority={priority?.urgency}
            >
              {bulkMode && (
                <input
                  type="checkbox"
                  className="thread-inbox-checkbox"
                  checked={isChecked}
                  onChange={() => toggleBulk(thread.id)}
                  aria-label={`Select ${thread.subject ?? "thread"}`}
                />
              )}
              <button
                type="button"
                className="thread-inbox-row"
                data-active={isSelected}
                data-unread={thread.unread ? "true" : undefined}
                onClick={() => {
                  if (bulkMode) {
                    toggleBulk(thread.id);
                    return;
                  }
                  setSelectedId(thread.id);
                }}
              >
                <span className="thread-inbox-row-line">
                  <span className="thread-inbox-row-sender">
                    {priority && (
                      <span
                        className="thread-inbox-priority-dot"
                        data-urgency={priority.urgency}
                        aria-hidden
                      />
                    )}
                    {!priority && thread.unread && (
                      <span className="thread-inbox-row-dot" aria-hidden />
                    )}
                    {thread.fromName?.trim() || thread.from?.trim() || "Unknown sender"}
                    {priority && (
                      <PriorityBadge
                        urgency={priority.urgency}
                        score={priority.score}
                        reason={priority.reason}
                        compact
                      />
                    )}
                    {Boolean(thread.messageCount && thread.messageCount > 1) && (
                      <span className="thread-inbox-row-count">{thread.messageCount}</span>
                    )}
                  </span>
                  <span className="thread-inbox-row-date">{formatListDate(thread.date)}</span>
                </span>
                <span className="thread-inbox-row-subject">
                  {listThreadSubject(thread.subject, thread.snippet)}
                  {threadLikelyHasAttachment(thread) && (
                    <Paperclip size={11} style={{ marginLeft: 6, opacity: 0.55, verticalAlign: "middle" }} aria-label="Likely has attachment" />
                  )}
                </span>
                <span className="thread-inbox-row-snippet">
                  {priority?.reason
                    ? priority.reason
                    : decodeHtmlEntities(thread.snippet)}
                </span>
              </button>
              {!bulkMode && (
                <div className="thread-inbox-row-hover-actions">
                  <button
                    type="button"
                    className="thread-inbox-hover-btn"
                    title="Archive (e)"
                    onClick={(ev) => { ev.stopPropagation(); archiveThread.mutate({ threadId: thread.id }); }}
                  >
                    <Archive size={13} />
                  </button>
                  <button
                    type="button"
                    className="thread-inbox-hover-btn"
                    title="Snooze until tomorrow"
                    onClick={(ev) => { ev.stopPropagation(); snoozeThread(thread.id, "tomorrow"); }}
                  >
                    <BellOff size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  };

  const renderLabelPickerContent = () => {
    if (labelsQuery.isLoading) {
      return <p className="thread-label-picker-head" style={{ padding: "8px 12px" }}>Loading labels…</p>;
    }
    if (labelsQuery.isError) {
      return (
        <p className="thread-label-picker-head" style={{ padding: "8px 12px", color: "var(--thread-danger, #f87171)" }}>
          Failed to load labels
        </p>
      );
    }
    if (!labelsQuery.data?.length) {
      return <p className="thread-label-picker-head" style={{ padding: "8px 12px" }}>No labels found</p>;
    }
    return (
      <>
        <p className="thread-label-picker-head">Apply label</p>
        {labelsQuery.data
          .filter((l) => l.type !== "system" || ["STARRED", "IMPORTANT"].includes(l.id))
          .slice(0, 15)
          .map((label) => (
            <button
              key={`apply-${label.id}`}
              type="button"
              className="thread-label-picker-item"
              onClick={() => {
                if (selectedId) {
                  applyLabel.mutate({ threadId: selectedId, labelId: label.id });
                }
                setShowLabelPicker(false);
              }}
            >
              {label.name}
            </button>
          ))}
        <p className="thread-label-picker-head" style={{ marginTop: 8 }}>Remove label</p>
        {labelsQuery.data
          .filter((l) => l.type !== "system" || ["STARRED", "IMPORTANT"].includes(l.id))
          .slice(0, 15)
          .map((label) => (
            <button
              key={`remove-${label.id}`}
              type="button"
              className="thread-label-picker-item"
              data-variant="remove"
              onClick={() => {
                if (selectedId) {
                  removeLabel.mutate({ threadId: selectedId, labelId: label.id });
                }
                setShowLabelPicker(false);
              }}
            >
              {label.name}
            </button>
          ))}
        <div className="thread-label-picker-create" style={{ padding: "8px 12px", borderTop: "1px solid var(--thread-border, #222)" }}>
          <p className="thread-label-picker-head">Create label</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Label name"
              maxLength={200}
              style={{ flex: 1, fontSize: 13 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLabelName.trim()) {
                  createLabel.mutate({ name: newLabelName.trim() });
                }
              }}
            />
            <button
              type="button"
              className="thread-btn-ghost"
              disabled={!newLabelName.trim() || createLabel.isPending}
              onClick={() => createLabel.mutate({ name: newLabelName.trim() })}
            >
              {createLabel.isPending ? "…" : "Create"}
            </button>
          </div>
        </div>
      </>
    );
  };

  // ── Reading pane sub-renderers (extracted to reduce cognitive complexity) ──

  const renderDisconnectedPane = () => (
    <div className="thread-app-empty">
      <div className="thread-app-empty-icon">
        <Mail size={24} />
      </div>
      <div>
        <h3>Your inbox is not connected</h3>
        <p>Connect Gmail through Corsair to pull mail into MailOS.</p>
      </div>
      <a
        href={connectHref}
        className="thread-btn-primary"
        style={{ fontSize: 13, padding: "10px 18px" }}
      >
        Connect Gmail
      </a>
    </div>
  );

  const renderLoadingPane = () => (
    <div className="thread-app-empty">
      <Loader2 size={22} className="thread-spin" />
      <p style={{ marginTop: 12, fontSize: 13, color: "var(--thread-dim)" }}>
        Opening thread…
      </p>
    </div>
  );

  const renderEmptyPane = () => (
    <div className="thread-app-empty">
      <div className="thread-app-empty-icon">
        <Mail size={24} />
      </div>
      <div>
        <h3>Select a thread</h3>
        <p>Choose a conversation from the list to preview it here.</p>
      </div>
    </div>
  );

  const renderToolbarActions = () => {
    const toggleStar = () => {
      if (!selectedId) return;
      if (starredIds.has(selectedId)) {
        unstarThread.mutate({ threadId: selectedId });
      } else {
        starThread.mutate({ threadId: selectedId });
      }
    };

    const toggleImportant = () => {
      if (!selectedId) return;
      if (importantIds.has(selectedId)) {
        markNotImportant.mutate({ threadId: selectedId });
      } else {
        markImportant.mutate({ threadId: selectedId });
      }
    };

    const toggleMute = () => {
      if (!selectedId) return;
      if (mutedThreadIds.has(selectedId)) {
        unmuteThread.mutate({ threadId: selectedId });
      } else {
        muteThread.mutate({ threadId: selectedId });
      }
    };

    const handleArchive = () => {
      if (!selectedId) return;
      archiveThread.mutate({ threadId: selectedId });
      setSelectedId(null);
    };

    const handleTrash = () => {
      if (!selectedId) return;
      trashThread.mutate({ threadId: selectedId });
    };

    const isStarred = !!(selectedId && starredIds.has(selectedId));
    const isImportant = !!(selectedId && importantIds.has(selectedId));
    const isMuted = mutedThreadIds.has(selectedId ?? "");

    return (
      <div className="thread-inbox-reading-toolbar">
        <button
          type="button"
          className="thread-inbox-action-primary"
          disabled={!calendarConnected || !replyTo.trim()}
          onClick={() => setShowSchedule(true)}
          title="Schedule meeting"
        >
          <CalendarPlus size={13} />
          Schedule
        </button>
        <div className="thread-inbox-action-divider" />
        <button
          type="button"
          className="thread-inbox-action-btn"
          data-active={isStarred ? "true" : undefined}
          disabled={starThread.isPending || unstarThread.isPending}
          onClick={toggleStar}
          title={isStarred ? "Unstar" : "Star (s)"}
        >
          <Star size={15} fill={isStarred ? "#fbbf24" : "none"} />
        </button>
        <button
          type="button"
          className="thread-inbox-action-btn"
          data-important={isImportant ? "true" : undefined}
          disabled={markImportant.isPending || markNotImportant.isPending}
          onClick={toggleImportant}
          title={isImportant ? "Remove important" : "Mark important (i)"}
        >
          <Zap size={15} fill={isImportant ? "#a78bfa" : "none"} />
        </button>
        <div className="thread-inbox-action-divider" />
        <button
          type="button"
          className="thread-inbox-action-btn"
          disabled={archiveThread.isPending}
          onClick={handleArchive}
          title="Archive (e)"
        >
          <Archive size={15} />
        </button>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="thread-inbox-action-btn"
            title="Snooze (b)"
            onClick={() => {
              const el = document.getElementById("thread-snooze-menu");
              if (el) {
                el.style.display = el.style.display === "none" ? "block" : "none";
              }
            }}
          >
            <BellOff size={15} />
          </button>
          <div id="thread-snooze-menu" className="thread-snooze-menu" style={{ display: "none" }}>
            {([
              { label: "Tomorrow 8am", when: "tomorrow" as const },
              { label: "Next week", when: "nextweek" as const },
            ]).map(({ label, when }) => (
              <button
                key={when}
                type="button"
                className="thread-snooze-option"
                onClick={() => {
                  if (selectedId) {
                    snoozeThread(selectedId, when);
                    setSelectedId(null);
                  }
                  const el = document.getElementById("thread-snooze-menu");
                  if (el) {
                    el.style.display = "none";
                  }
                }}
              >
                <Clock size={11} />
                {label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="thread-inbox-action-btn thread-inbox-action-btn--danger"
          disabled={trashThread.isPending}
          onClick={handleTrash}
          title="Move to trash"
        >
          <Trash2 size={15} />
        </button>
        <button
          type="button"
          className="thread-inbox-action-btn"
          disabled={muteThread.isPending || unmuteThread.isPending}
          onClick={toggleMute}
          title={isMuted ? "Unmute thread" : "Mute thread (m) — future messages skip inbox"}
        >
          <BellOff size={15} style={{ opacity: isMuted ? 1 : 0.6 }} />
        </button>
        <div className="thread-inbox-action-divider" />
        <div ref={labelPickerRef} style={{ position: "relative" }}>
          <button
            type="button"
            className="thread-inbox-action-btn"
            onClick={() => setShowLabelPicker((v) => !v)}
            title="Apply label"
          >
            <Tag size={15} />
          </button>
          {showLabelPicker && (
            <div className="thread-label-picker">
              {renderLabelPickerContent()}
            </div>
          )}
        </div>
        <button
          type="button"
          className="thread-inbox-action-btn"
          style={showContextPanel ? { color: "var(--thread-accent-bright)" } : undefined}
          onClick={() => setShowContextPanel((v) => !v)}
          title="AI context panel"
        >
          <PanelRight size={15} />
        </button>
      </div>
    );
  };

  const renderMessageAttachments = (messageAttachments: NonNullable<typeof threadMessages[number]["attachments"]>, messageId: string) => {
    if (messageAttachments.length === 0) return null;
    return (
      <div className="thread-inbox-attachments">
        <p className="thread-inbox-attachments-label">
          <FileText size={12} />
          {messageAttachments.length === 1
            ? "1 attachment"
            : `${messageAttachments.length} attachments`}
        </p>
        <ul className="thread-inbox-attachment-list">
          {messageAttachments.map((att) => {
            const sizeLabel = formatAttachmentSize(att.size);
            const downloadUrl = att.attachmentId && messageId
              ? `/inbox/attachments/${messageId}/${att.attachmentId}?filename=${encodeURIComponent(att.filename)}&mimeType=${encodeURIComponent(att.mimeType ?? "application/octet-stream")}`
              : null;
            return (
              <li key={att.attachmentId ?? att.filename} className="thread-inbox-attachment-item">
                <FileText size={12} />
                {downloadUrl ? (
                  <a
                    href={downloadUrl}
                    download={att.filename}
                    className="thread-inbox-attachment-name thread-inbox-attachment-link"
                    title={`Download ${att.filename}`}
                  >
                    {att.filename}
                  </a>
                ) : (
                  <span className="thread-inbox-attachment-name">{att.filename}</span>
                )}
                {sizeLabel && (
                  <span className="thread-inbox-attachment-size">{sizeLabel}</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderThreadMessages = (data: NonNullable<typeof selectedQuery.data>) => {
    if (threadMessages.length === 0) {
      return (
        <EmailMessageBody
          bodyHtml={data.messages?.at(-1)?.bodyHtml}
          body={data.body}
          snippet={data.snippet}
          className="thread-inbox-message-body"
        />
      );
    }

    return threadMessages.map((message, index) => {
      const expanded = expandedMessageIds.has(message.id);
      const isLast = index === threadMessages.length - 1;
      const isActive = activeMessageId === message.id;
      const messageAttachments = message.attachments ?? [];
      return (
        <article
          key={message.id}
          className="thread-inbox-msg"
          data-expanded={expanded}
          data-last={isLast}
          data-active={isActive}
        >
          <button
            type="button"
            className="thread-inbox-msg-head"
            onClick={() => handleMessageClick(message)}
            aria-expanded={expanded}
            aria-pressed={isActive}
          >
            <SenderAvatar
              from={message.from}
              selfEmail={userEmail}
              selfPhotoUrl={userPhotoUrl}
            />
            <span className="thread-inbox-msg-summary">
              <span className="thread-inbox-msg-top">
                <strong>{displaySender(message.from)}</strong>
                <span className="thread-inbox-msg-date">
                  {formatMessageDate(message.date)}
                </span>
              </span>
              {!expanded ? (
                <span className="thread-inbox-msg-snippet">
                  {message.body?.trim() || message.snippet}
                </span>
              ) : (
                <span className="thread-inbox-msg-to">
                  to {displaySender(message.to) || parseReplyTo(message.to) || "you"}
                </span>
              )}
            </span>
          </button>
          {expanded && (
            <>
              <EmailMessageBody
                bodyHtml={message.bodyHtml}
                body={message.body}
                snippet={message.snippet}
              />
              {renderMessageAttachments(messageAttachments, message.id)}
            </>
          )}
        </article>
      );
    });
  };

  const renderRsvpBanner = () => {
    if (!rsvpIsInvite) return null;

    const handleRsvpResponse = (response: "accepted" | "tentative" | "declined", successMsg: string) => {
      if (!rsvpEvent) return;
      void utils.client.calendar.respondToEvent
        .mutate({ eventId: rsvpEvent.id, response })
        .then(() => toast.success(successMsg))
        .catch((e: Error) => toast.error(e.message));
    };

    return (
      <div className="thread-rsvp-banner">
        <div className="thread-rsvp-banner-label">
          <CalendarPlus size={13} />
          <strong>Meeting invite detected</strong>
          {rsvpEvent && (
            <span style={{ fontWeight: 400, opacity: 0.7, fontSize: 11, marginLeft: 6 }}>
              — {rsvpEvent.summary}
            </span>
          )}
        </div>
        <div className="thread-rsvp-actions">
          {rsvpEvent ? (
            <>
              <button type="button" className="thread-rsvp-btn thread-rsvp-btn--accept"
                onClick={() => handleRsvpResponse("accepted", "Accepted — calendar updated via Corsair")}>
                Accept
              </button>
              <button type="button" className="thread-rsvp-btn thread-rsvp-btn--tentative"
                onClick={() => handleRsvpResponse("tentative", "Marked tentative")}>
                Maybe
              </button>
              <button type="button" className="thread-rsvp-btn thread-rsvp-btn--decline"
                onClick={() => handleRsvpResponse("declined", "Declined — calendar updated")}>
                Decline
              </button>
            </>
          ) : (
            <Link href="/calendar" className="thread-rsvp-btn thread-rsvp-btn--accept">
              View in Calendar
            </Link>
          )}
          <button
            type="button"
            className="thread-btn-ghost"
            style={{ fontSize: 12, padding: "6px 10px" }}
            onClick={() => setShowSchedule(true)}
          >
            <CalendarPlus size={12} />
            Schedule
          </button>
        </div>
      </div>
    );
  };

  const renderComposeSection = () => (
    <div className="thread-inbox-compose">
      <div className="thread-inbox-compose-head">
        <h3>Reply</h3>
        <span className="thread-mono-tag">Queued before send</span>
      </div>
      <label className="thread-set-label" htmlFor="reply-to">
        To
        {activeMessageId && (
          <span className="thread-inbox-reply-hint"> — replying based on selected message</span>
        )}
      </label>
      <input
        id="reply-to"
        className="thread-set-input"
        value={replyTo}
        onChange={(event) => setReplyTo(event.target.value)}
      />
      <label className="thread-set-label" htmlFor="reply-cc">
        Cc
      </label>
      <input
        id="reply-cc"
        className="thread-set-input"
        placeholder="Optional — comma-separated"
        value={replyCc}
        onChange={(event) => setReplyCc(event.target.value)}
      />
      <label className="thread-set-label" htmlFor="reply-bcc">
        Bcc
      </label>
      <input
        id="reply-bcc"
        className="thread-set-input"
        placeholder="Optional — comma-separated"
        value={replyBcc}
        onChange={(event) => setReplyBcc(event.target.value)}
      />
      <label className="thread-set-label" htmlFor="reply-subject">
        Subject
      </label>
      <input
        id="reply-subject"
        className="thread-set-input"
        value={replySubjectValue}
        onChange={(event) => setReplySubjectValue(event.target.value)}
      />
      {/* AI Thread Summary */}
      {aiReady && selectedId && (
        <div className="thread-smart-reply-wrap thread-ai-panel">
          <AiThreadSummaryContent
            isConnected={isConnected}
            hasDemoFixtures={hasDemoFixtures}
            demoSummarizeEnabled={demoSummarizeEnabled}
            isDemoUser={isDemoUser}
            mailDemoState={mailDemoState}
            onEnableDemoSummarize={() => {
              if (isDemoUser && !tryMailDemo()) {
                return;
              }
              setDemoSummarizeEnabled(true);
            }}
            isLoading={summarizeQuery.isLoading}
            isError={summarizeQuery.isError}
            data={summarizeQuery.data}
            onRetry={() => void summarizeQuery.refetch()}
          />
        </div>
      )}
      {/* Smart Reply suggestions */}
      {aiReady && selectedId && (isConnected || demoSummarizeEnabled) && (
        <div className="thread-smart-reply-wrap thread-ai-panel">
          <SmartRepliesContent
            isLoading={smartRepliesQuery.isLoading}
            suggestions={smartRepliesQuery.data?.suggestions}
            onPickSuggestion={(s) => {
              setReplyBody(s.body);
              if (smartRepliesQuery.data?.replyTo && !replyTo.trim()) {
                setReplyTo(smartRepliesQuery.data.replyTo);
              }
            }}
          />
        </div>
      )}
      <label className="thread-set-label" htmlFor="reply-body">
        Message
      </label>
      <textarea
        id="reply-body"
        className="thread-set-input thread-inbox-compose-body"
        rows={8}
        value={replyBody}
        onChange={(event) => setReplyBody(event.target.value)}
        placeholder="Write your reply…"
      />
      <label className="thread-set-label" htmlFor="reply-attachments">
        Attachments
      </label>
      <input
        id="reply-attachments"
        type="file"
        multiple
        className="thread-set-input"
        onChange={(event) => { pickAttachments(event.target.files).catch(console.error); }}
      />
      {outboundAttachments.length > 0 && (
        <ul className="thread-inbox-attachment-list" style={{ marginBottom: 8 }}>
          {outboundAttachments.map((att) => (
            <li key={att.id} className="thread-inbox-attachment-item">
              <FileText size={12} />
              <span className="thread-inbox-attachment-name">{att.filename}</span>
              <button
                type="button"
                className="thread-btn-ghost"
                style={{ marginLeft: "auto", fontSize: 11, padding: "2px 6px" }}
                onClick={() => removeOutboundAttachment(att.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="thread-inbox-compose-actions">
        <button
          type="button"
          className="thread-btn-ghost"
          disabled={queueEmail.isPending || !replyBody.trim()}
          onClick={() =>
            queueEmail.mutate({ mode: "draft", email: emailPayload, title: "Draft reply" })
          }
        >
          <FilePenLine size={14} />
          Queue draft
        </button>
        <button
          type="button"
          className="thread-btn-accent"
          disabled={queueEmail.isPending || !replyBody.trim() || !replyTo.trim()}
          onClick={() =>
            queueEmail.mutate({ mode: "send", email: emailPayload, title: "Reply email" })
          }
        >
          <ListChecks size={14} />
          {queueEmail.isPending ? "Queuing…" : "Add to queue"}
        </button>
      </div>
      <p className="thread-inbox-compose-note">
        Approve queued actions from <Link href="/queue">Queue</Link>. Nothing sends until you
        approve.
      </p>
    </div>
  );

  const renderReadingPane = () => {
    if (!isConnected && !hasDemoFixtures) return renderDisconnectedPane();
    if (selectedQuery.isLoading) return renderLoadingPane();
    if (!selectedQuery.data) return renderEmptyPane();

    const msgs = selectedQuery.data.messages ?? [];
    const allText = msgs.map((m) => (m.body ?? "") + (m.bodyHtml ?? "")).join(" ");
    const unsubMatch = allText.match(/href=["']([^"']*?unsubscribe[^"']*?)["']/i)
      ?? allText.match(/href=["']([^"']*?optout[^"']*?)["']/i)
      ?? allText.match(/href=["']([^"']*?opt-out[^"']*?)["']/i);
    const unsubUrl = unsubMatch ? unsubMatch[1] : null;

    return (
      <div className="thread-inbox-message thread-inbox-message--split">
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <button
            type="button"
            className="thread-inbox-back-btn"
            onClick={() => setSelectedId(null)}
          >
            ← Back
          </button>
          <div className="thread-inbox-message-head">
            <div className="thread-inbox-message-head-row">
              <div>
                <h2>{selectedQuery.data.subject?.trim() || "No subject"}</h2>
                {selectedAttachmentCount > 0 && (
                  <p className="thread-inbox-message-count">
                    <Paperclip size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {selectedAttachmentCount === 1
                      ? "1 attachment in this thread"
                      : `${selectedAttachmentCount} attachments in this thread`}
                  </p>
                )}
                {threadMessages.length > 1 && (
                  <p className="thread-inbox-message-count">
                    {threadMessages.length} messages in this conversation
                  </p>
                )}
              </div>
              {/* Reading pane action toolbar — icon buttons */}
              {renderToolbarActions()}
            </div>
          </div>

          <div className="thread-inbox-thread">
            {renderThreadMessages(selectedQuery.data)}
          </div>

          {/* ── Unsubscribe banner ─────────────────────────────────────────── */}
          {unsubUrl && (
            <div className="thread-unsub-banner">
              <span className="thread-unsub-banner-label">Looks like a mailing list</span>
              <a
                href={unsubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="thread-unsub-btn"
              >
                <ExternalLink size={11} />
                Unsubscribe
              </a>
              <button
                type="button"
                className="thread-unsub-archive"
                onClick={() => {
                  if (selectedId) {
                    archiveThread.mutate({ threadId: selectedId });
                  }
                }}
              >
                <Archive size={11} />
                Archive
              </button>
            </div>
          )}

          {/* ── RSVP inline ────────────────────────────────────────────────── */}
          {renderRsvpBanner()}

          {renderComposeSection()}
        </div>
        {/* Smart Context Panel */}
        {showContextPanel && selectedId && (
          <div className="scp-sidebar">
            <SmartContextPanel
              threadId={selectedId}
              onOpenThread={(id) => setSelectedId(id)}
            />
          </div>
        )}
      </div>
    );
  };

  const showThreadList = view !== "drafts";

  return (
    <div className="thread-inbox" data-selected={selectedId ? "true" : undefined}>
      <div className="thread-inbox-list">
        <InboxListHeader
          view={view}
          onViewChange={handleViewChange}
          aiReady={aiReady}
          priorityVisibleCount={priorityVisibleCount}
          isConnected={isConnected}
          isPriorityRanking={rankThreads.isPending}
          onPriorityRefresh={handlePriorityRefresh}
          bulkMode={bulkMode}
          onToggleBulkMode={handleToggleBulkMode}
          onOpenCompose={() => setShowCompose(true)}
        />

        {bulkMode && (
          <InboxBulkBar
            bulkSelectedCount={bulkSelected.size}
            onArchive={() => void bulkArchive()}
            onMarkRead={() => void bulkMarkRead()}
            onStar={() => void bulkStar()}
            onSnooze={bulkSnooze}
            onTrash={() => void bulkTrash()}
            onCancel={clearBulk}
          />
        )}

        <InboxSearchFilterBar
          isVisible={isConnected && showThreadList}
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          onClearSearch={() => setSearchInput("")}
          searchRef={searchRef}
          dbSearchMode={dbSearchMode}
          onToggleDbSearch={() => setDbSearchMode((v) => !v)}
          appliedQuery={appliedQuery}
          onToggleAttachmentFilter={handleToggleAttachmentFilter}
          labels={labelsQuery.data}
          labelFilter={labelFilter}
          onLabelFilterChange={setLabelFilter}
        />

        {view === "priority" && isConnected && (
          <div className="thread-priority-summary">
            <PrioritySummaryBanner
              isPending={rankThreads.isPending}
              priorityAnalysis={priorityAnalysis}
              aiReady={aiReady}
            />
          </div>
        )}

        {hasDemoFixtures && (
          <div className="thread-demo-inbox-strip" style={{ margin: "10px 12px 0" }}>
            <Sparkles size={13} />
            <span>Demo inbox — {demoCacheQuery.data?.threads.length ?? 0} sample threads</span>
            <span className="thread-demo-inbox-strip-sep">·</span>
            <Link href="/brief" className="thread-demo-inbox-strip-link">Brief</Link>
            <Link href="/agent" className="thread-demo-inbox-strip-link">Agent</Link>
            <Link href="/queue" className="thread-demo-inbox-strip-link">Queue</Link>
          </div>
        )}

        {banner && (
          <div
            className="thread-inbox-banner"
            data-variant={banner.type}
            style={{ margin: "10px 12px 0" }}
          >
            {banner.text}
          </div>
        )}

        <div className="thread-inbox-list-body">
          {renderListBody()}
        </div>

        <InboxPaginationFooter
          isConnected={isConnected}
          view={view}
          visibleThreadCount={visibleThreads.length}
          inboxRefreshing={inbox.isRefreshing}
          inboxNextPageToken={inbox.nextPageToken}
          inboxFetchingMore={inbox.isFetchingMore}
          onInboxLoadMore={inbox.loadMore}
          draftsCount={drafts.drafts.length}
          draftsNextPageToken={drafts.nextPageToken}
          draftsFetchingMore={drafts.isFetchingMore}
          onDraftsLoadMore={drafts.loadMore}
        />
      </div>

      <div className="thread-inbox-reading">
        {renderReadingPane()}
      </div>

      <ScheduleMeetingDialog
        isOpen={showSchedule}
        onClose={() => setShowSchedule(false)}
        dialogRef={scheduleDialogRef}
        meetingTitle={meetingTitle}
        setMeetingTitle={setMeetingTitle}
        replyTo={replyTo}
        setReplyTo={setReplyTo}
        meetingStart={meetingStart}
        setMeetingStart={setMeetingStart}
        meetingEnd={meetingEnd}
        setMeetingEnd={setMeetingEnd}
        replyBody={replyBody}
        setReplyBody={setReplyBody}
        isPending={queueMeeting.isPending}
        onSubmit={handleScheduleSubmit}
      />

      <ComposeEmailDialog
        isOpen={showCompose}
        onClose={() => setShowCompose(false)}
        dialogRef={composeDialogRef}
        composeTo={composeTo}
        setComposeTo={setComposeTo}
        composeCc={composeCc}
        setComposeCc={setComposeCc}
        composeBcc={composeBcc}
        setComposeBcc={setComposeBcc}
        composeSubject={composeSubject}
        setComposeSubject={setComposeSubject}
        composeBody={composeBody}
        setComposeBody={setComposeBody}
        outboundAttachments={outboundAttachments}
        onPickAttachments={(files) => { pickAttachments(files).catch(console.error); }}
        isPending={queueEmail.isPending}
        onSend={handleComposeSend}
        onSaveDraft={handleComposeSaveDraft}
      />

      {mailDemoModal}
    </div>
  );
}
