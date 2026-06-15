"use client";

import React, { useRef, useEffect, useState } from "react";
import { Mail, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Email, MailTab } from "@/hooks/useEmails";

const EMAILS_PER_PAGE = 15;

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
  activeTab: MailTab;
  onTabChange: (tab: MailTab) => void;
  loading: boolean;
  onCommandPaletteOpen: () => void;
}

const TABS: { id: MailTab; label: string }[] = [
  { id: "all", label: "All mail" },
  { id: "priority", label: "Priority" },
  { id: "newsletters", label: "Newsletters" },
  { id: "updates", label: "Updates" },
];

/** Strip email address from "Name <email>" format, returning just the name */
function cleanSenderName(from: string): string {
  if (!from) return "Unknown";
  // Remove <email@address> part
  const cleaned = from.replace(/<[^>]+>/g, "").trim();
  // Remove surrounding quotes
  return cleaned.replace(/^["']|["']$/g, "").trim() || from;
}

/** Get first letter of cleaned sender name for avatar */
function getInitial(from: string): string {
  const name = cleanSenderName(from);
  return name.charAt(0).toUpperCase() || "?";
}

export default function EmailList({
  emails,
  selectedEmailId,
  onSelectEmail,
  activeTab,
  onTabChange,
  loading,
  onCommandPaletteOpen,
}: EmailListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // Reset to first page when emails or tab changes
  useEffect(() => {
    setCurrentPage(0);
  }, [activeTab, emails.length]);

  // Auto-scroll to selected email
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedEmailId]);

  const totalPages = Math.max(1, Math.ceil(emails.length / EMAILS_PER_PAGE));
  const startIdx = currentPage * EMAILS_PER_PAGE;
  const endIdx = startIdx + EMAILS_PER_PAGE;
  const paginatedEmails = emails.slice(startIdx, endIdx);

  const goToPrevPage = () => {
    setCurrentPage((p) => Math.max(0, p - 1));
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToNextPage = () => {
    setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-w-0 border-r flex flex-col flex-1" style={{ borderColor: "rgba(var(--border-primary))" }}>
      {/* Header */}
      <header className="flex px-6 pt-6 pb-4 items-center gap-4">
        <h1 className="font-semibold text-xl leading-7 tracking-tight" style={{ color: "rgb(var(--text-primary))" }}>
          Inbox
        </h1>
        <div className="rounded-lg flex p-1 items-center gap-1" style={{ background: "rgb(var(--bg-tertiary))" }}>
          {["all", "priority"].map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab as MailTab)}
              className="font-medium rounded-md text-sm leading-5 px-3 py-1 transition-all capitalize"
              style={{
                background: activeTab === tab ? "rgb(var(--bg-secondary))" : "transparent",
                color: activeTab === tab ? "rgb(var(--text-primary))" : "rgb(var(--text-secondary))",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-6">
        <div
          className="rounded-lg border flex px-3 py-2 items-center gap-2 cursor-pointer transition-colors"
          onClick={onCommandPaletteOpen}
          style={{
            background: "rgba(var(--bg-tertiary), 0.6)",
            borderColor: "rgba(var(--border-primary))",
          }}
        >
          <Search className="size-4" style={{ color: "rgb(var(--text-secondary))" }} />
          <span className="text-sm leading-5 flex-1" style={{ color: "rgb(var(--text-secondary))" }}>
            Search emails...
          </span>
          <kbd
            className="rounded-md text-xs leading-4 border px-1.5 py-0.5"
            style={{
              background: "rgb(var(--kbd-bg))",
              color: "rgb(var(--text-secondary))",
              borderColor: "rgba(var(--border-primary))",
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="border-b flex px-4 pt-4 items-center gap-4 overflow-x-auto flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ borderColor: "rgba(var(--border-primary))" }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="font-medium text-sm leading-5 -mb-px pb-3 transition-colors shrink-0"
            style={{
              color:
                activeTab === tab.id
                  ? "rgb(var(--text-primary))"
                  : "rgb(var(--text-secondary))",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid rgb(var(--text-primary))"
                  : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Email List */}
      <div ref={listRef} className="overflow-y-auto flex-1">
        {loading ? (
          // Skeleton loading
          <div className="flex flex-col">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="border-b flex px-6 py-3 items-start gap-3"
                style={{ borderColor: "rgba(var(--border-primary))" }}
              >
                <div className="size-9 rounded-full skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 w-32 skeleton" />
                    <div className="h-3 w-12 skeleton" />
                  </div>
                  <div className="h-4 w-48 skeleton" />
                  <div className="h-3 w-64 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="h-full flex flex-col justify-center items-center text-center p-6">
            <Mail className="size-8 mb-2" style={{ color: "rgba(var(--text-secondary), 0.3)" }} />
            <p className="text-sm font-medium" style={{ color: "rgb(var(--text-primary))" }}>
              No emails found
            </p>
            <p className="text-xs max-w-[200px] mt-1" style={{ color: "rgb(var(--text-secondary))" }}>
              This inbox view has no emails fitting this category.
            </p>
          </div>
        ) : (
          paginatedEmails.map((email) => {
            const isSelected = selectedEmailId === email.id;
            const senderName = cleanSenderName(email.from);
            const initial = getInitial(email.from);

            return (
              <div
                key={email.id}
                ref={isSelected ? selectedRef : undefined}
                onClick={() => onSelectEmail(email.id)}
                className="border-b flex px-6 py-3 items-start gap-3 cursor-pointer transition-all"
                style={{
                  borderColor: "rgba(var(--border-primary))",
                  background: isSelected
                    ? "rgba(var(--bg-tertiary), 0.6)"
                    : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "rgba(var(--bg-secondary), 0.4)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback
                    className="font-semibold text-xs leading-4"
                    style={{
                      background:
                        email.priority === "high"
                          ? "rgba(var(--accent-red), 0.15)"
                          : email.priority === "med"
                          ? "rgba(var(--accent-orange), 0.15)"
                          : "rgb(var(--bg-tertiary))",
                      color:
                        email.priority === "high"
                          ? "rgb(var(--accent-red))"
                          : email.priority === "med"
                          ? "rgb(var(--accent-orange))"
                          : "rgb(var(--text-secondary))",
                    }}
                  >
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center gap-2">
                    <p
                      className={`truncate text-sm leading-5 ${
                        email.unread ? "font-semibold" : "font-medium"
                      }`}
                      style={{
                        color: email.unread
                          ? "rgb(var(--text-primary))"
                          : "rgba(var(--text-primary), 0.85)",
                      }}
                    >
                      {senderName}
                    </p>
                    <span
                      className="shrink-0 text-xs leading-4"
                      style={{ color: "rgb(var(--text-secondary))" }}
                    >
                      {email.date}
                    </span>
                  </div>
                  <div className="flex mt-0.5 justify-between items-center gap-2">
                    <p
                      className={`truncate text-sm leading-5 ${
                        email.unread ? "font-semibold" : ""
                      }`}
                      style={{
                        color: email.unread
                          ? "rgb(var(--text-primary))"
                          : "rgba(var(--text-primary), 0.75)",
                      }}
                    >
                      {email.subject}
                    </p>
                    {email.priority && (
                      <span
                        className="shrink-0 font-medium rounded-full text-[10px] leading-3 px-2 py-0.5"
                        style={{
                          background:
                            email.priority === "high"
                              ? "rgba(var(--accent-red), 0.12)"
                              : email.priority === "med"
                              ? "rgba(var(--accent-orange), 0.12)"
                              : "rgb(var(--bg-tertiary))",
                          color:
                            email.priority === "high"
                              ? "rgb(var(--accent-red))"
                              : email.priority === "med"
                              ? "rgb(var(--accent-orange))"
                              : "rgb(var(--text-secondary))",
                        }}
                      >
                        {email.priority}
                      </span>
                    )}
                  </div>
                  <p
                    className="truncate text-xs leading-4 mt-0.5"
                    style={{ color: "rgb(var(--text-secondary))" }}
                  >
                    {email.snippet}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {!loading && emails.length > 0 && (
        <div
          className="border-t flex px-6 py-2.5 items-center justify-between"
          style={{
            borderColor: "rgba(var(--border-primary))",
          }}
        >
          <span
            className="text-xs leading-4"
            style={{ color: "rgb(var(--text-secondary))" }}
          >
            {startIdx + 1}–{Math.min(endIdx, emails.length)} of {emails.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevPage}
              disabled={currentPage === 0}
              className="rounded-md p-1.5 transition-colors"
              style={{
                color: currentPage === 0 ? "rgba(var(--text-secondary), 0.3)" : "rgb(var(--text-secondary))",
                cursor: currentPage === 0 ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (currentPage !== 0) e.currentTarget.style.background = "rgba(var(--bg-tertiary), 0.8)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages - 1}
              className="rounded-md p-1.5 transition-colors"
              style={{
                color: currentPage >= totalPages - 1 ? "rgba(var(--text-secondary), 0.3)" : "rgb(var(--text-secondary))",
                cursor: currentPage >= totalPages - 1 ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (currentPage < totalPages - 1) e.currentTarget.style.background = "rgba(var(--bg-tertiary), 0.8)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Shortcuts Bar */}
      <div
        className="text-xs leading-4 border-t flex px-6 py-3 items-center gap-3"
        style={{
          borderColor: "rgba(var(--border-primary))",
          color: "rgb(var(--text-secondary))",
        }}
      >
        {[
          { keys: "J/K", action: "navigate" },
          { keys: "R", action: "reply" },
          { keys: "E", action: "archive" },
          { keys: "S", action: "snooze" },
          { keys: "C", action: "compose" },
        ].map((shortcut) => (
          <span key={shortcut.keys} className="flex items-center gap-1.5">
            <kbd
              className="rounded-sm border px-1.5 py-0.5"
              style={{
                background: "rgb(var(--kbd-bg))",
                borderColor: "rgba(var(--border-primary))",
              }}
            >
              {shortcut.keys}
            </kbd>
            {shortcut.action}
          </span>
        ))}
        <span className="flex ml-auto items-center gap-1.5">
          <kbd
            className="rounded-sm border px-1.5 py-0.5"
            style={{
              background: "rgb(var(--kbd-bg))",
              borderColor: "rgba(var(--border-primary))",
            }}
          >
            ⌘K
          </kbd>
        </span>
        <span className="flex items-center gap-1.5">
          <kbd
            className="rounded-sm border px-1.5 py-0.5"
            style={{
              background: "rgb(var(--kbd-bg))",
              borderColor: "rgba(var(--border-primary))",
            }}
          >
            ?
          </kbd>
        </span>
      </div>
    </div>
  );
}
