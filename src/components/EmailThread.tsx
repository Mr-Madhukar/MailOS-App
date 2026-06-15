"use client";

import React, { useState } from "react";
import {
  Archive,
  ArrowLeft,
  Clock,
  Forward,
  Mail,
  MoreHorizontal,
  Reply,
  ReplyAll,
  Star,
  Tag,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Email } from "@/hooks/useEmails";

interface EmailThreadProps {
  email: Email | null;
  onBack?: () => void;
  onReply: (id: string) => void;
  onArchive: (id: string) => void;
  onStar: (id: string) => void;
  onSnooze: (id: string) => void;
  onCompose: (replyTo?: { to: string; subject: string; body: string }) => void;
}

export default function EmailThread({
  email,
  onBack,
  onReply,
  onArchive,
  onStar,
  onSnooze,
  onCompose,
}: EmailThreadProps) {
  const [replyBody, setReplyBody] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [sending, setSending] = useState(false);

  if (!email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in">
        <div
          className="size-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "rgb(var(--bg-tertiary))" }}
        >
          <Mail className="size-7" style={{ color: "rgb(var(--text-tertiary))" }} />
        </div>
        <p className="text-sm font-medium" style={{ color: "rgb(var(--text-primary))" }}>
          Select an email to read
        </p>
        <p className="text-xs mt-1.5" style={{ color: "rgb(var(--text-secondary))" }}>
          Use J/K to navigate, Enter to open
        </p>
      </div>
    );
  }

  const initials = email.from
    ? email.from.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  const handleReplySubmit = async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    try {
      onReply(email.id);
      setReplyBody("");
      setIsReplying(false);
    } finally {
      setSending(false);
    }
  };

  const ActionButton = ({
    icon: Icon,
    label,
    onClick,
    danger,
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    danger?: boolean;
  }) => (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
      style={{
        color: danger ? "rgb(var(--accent-red))" : "rgb(var(--text-secondary))",
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? "rgba(var(--accent-red), 0.1)"
          : "rgb(var(--bg-tertiary))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <Icon className="size-3.5" />
      <span className="hide-mobile">{label}</span>
    </button>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
      {/* Thread Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b shrink-0"
        style={{ borderColor: "rgba(var(--border-primary))" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="size-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "rgb(var(--text-secondary))" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgb(var(--bg-tertiary))")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <h2
            className="font-semibold text-lg leading-6 truncate"
            style={{ color: "rgb(var(--text-primary))" }}
          >
            {email.subject}
          </h2>
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
              {email.priority === "high"
                ? "High Priority"
                : email.priority === "med"
                ? "Medium"
                : "Low"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <ActionButton icon={Archive} label="Archive" onClick={() => onArchive(email.id)} />
          <ActionButton icon={Clock} label="Snooze" onClick={() => onSnooze(email.id)} />
          <ActionButton
            icon={Star}
            label={email.labelIds?.includes("STARRED") ? "Unstar" : "Star"}
            onClick={() => onStar(email.id)}
          />
          <ActionButton icon={Trash2} label="Delete" onClick={() => {}} danger />
        </div>
      </div>

      {/* Thread Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl">
          {/* Sender Info */}
          <div className="flex items-start gap-3 mb-6">
            <Avatar className="size-10 shrink-0">
              <AvatarFallback
                className="font-semibold text-sm"
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
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm" style={{ color: "rgb(var(--text-primary))" }}>
                  {email.from}
                </p>
                <span className="text-xs" style={{ color: "rgb(var(--text-tertiary))" }}>
                  {email.date}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: "rgb(var(--text-secondary))" }}>
                to me
              </p>
            </div>
          </div>

          {/* Email Body Content */}
          <div
            className="prose prose-sm max-w-none text-sm leading-relaxed space-y-3"
            style={{ color: "rgb(var(--text-primary))" }}
          >
            {/* Use the snippet as body preview — full body would come from individual email fetch */}
            <p>{email.snippet}</p>
            {email.body ? (
              <div dangerouslySetInnerHTML={{ __html: email.body }} />
            ) : (
              <div
                className="rounded-lg p-4 mt-4 border"
                style={{
                  background: "rgba(var(--bg-tertiary), 0.5)",
                  borderColor: "rgba(var(--border-secondary))",
                }}
              >
                <p className="text-xs italic" style={{ color: "rgb(var(--text-secondary))" }}>
                  Full email body is loaded when connected to Gmail. Currently showing preview.
                </p>
              </div>
            )}
          </div>

          {/* Reply Actions */}
          <div
            className="mt-8 pt-6 border-t flex items-center gap-2"
            style={{ borderColor: "rgba(var(--border-primary))" }}
          >
            <button
              onClick={() => setIsReplying(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all"
              style={{
                borderColor: "rgba(var(--border-primary))",
                color: "rgb(var(--text-primary))",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgb(var(--bg-tertiary))")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Reply className="size-4" />
              Reply
            </button>
            <button
              onClick={() => setIsReplying(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all"
              style={{
                borderColor: "rgba(var(--border-primary))",
                color: "rgb(var(--text-primary))",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgb(var(--bg-tertiary))")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <ReplyAll className="size-4" />
              Reply All
            </button>
            <button
              onClick={() =>
                onCompose({
                  to: "",
                  subject: `Fwd: ${email.subject}`,
                  body: `\n\n--- Forwarded message ---\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.snippet}`,
                })
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all"
              style={{
                borderColor: "rgba(var(--border-primary))",
                color: "rgb(var(--text-primary))",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "rgb(var(--bg-tertiary))")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Forward className="size-4" />
              Forward
            </button>
          </div>

          {/* Inline Reply Box */}
          {isReplying && (
            <div className="mt-4 animate-slide-up">
              <div
                className="rounded-xl border p-4"
                style={{
                  borderColor: "rgba(var(--border-primary))",
                  background: "rgb(var(--bg-secondary))",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Reply className="size-4" style={{ color: "rgb(var(--text-secondary))" }} />
                  <span className="text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
                    Replying to {email.from}
                  </span>
                </div>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Type your reply..."
                  rows={5}
                  autoFocus
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1"
                  style={{
                    background: "rgb(var(--bg-primary))",
                    borderColor: "rgba(var(--border-primary))",
                    color: "rgb(var(--text-primary))",
                  }}
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => {
                      setIsReplying(false);
                      setReplyBody("");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                    style={{
                      borderColor: "rgba(var(--border-primary))",
                      color: "rgb(var(--text-secondary))",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReplySubmit}
                    disabled={!replyBody.trim() || sending}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                    style={{
                      background: "rgb(var(--btn-primary-bg))",
                      color: "rgb(var(--btn-primary-text))",
                    }}
                  >
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
