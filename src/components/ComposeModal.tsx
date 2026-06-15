"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  Minus,
  Paperclip,
  Send,
  X,
} from "lucide-react";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (to: string, subject: string, body: string) => Promise<void>;
  onCreateEvent?: (input: {
    summary: string;
    startDateTime: string;
    endDateTime: string;
    attendees?: string[];
  }) => Promise<void>;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
}

// Calendar intent detection keywords
const CALENDAR_KEYWORDS = [
  "meet",
  "meeting",
  "schedule",
  "call",
  "sync",
  "catch up",
  "standup",
  "coffee",
  "lunch",
  "let's connect",
  "hop on a call",
  "available",
  "free at",
  "how about",
  "calendar",
  "invite",
];

export default function ComposeModal({
  isOpen,
  onClose,
  onSend,
  onCreateEvent,
  initialTo = "",
  initialSubject = "",
  initialBody = "",
}: ComposeModalProps) {
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [showCalendarPrompt, setShowCalendarPrompt] = useState(false);
  const [calendarDetails, setCalendarDetails] = useState({
    date: "",
    startTime: "09:00",
    endTime: "10:00",
  });
  const [minimized, setMinimized] = useState(false);
  const toInputRef = useRef<HTMLInputElement>(null);

  // Focus on open
  useEffect(() => {
    if (isOpen && !minimized) {
      setTimeout(() => toInputRef.current?.focus(), 100);
    }
  }, [isOpen, minimized]);

  // Calendar-aware detection
  useEffect(() => {
    const lowerBody = body.toLowerCase();
    const lowerSubject = subject.toLowerCase();
    const textToCheck = `${lowerBody} ${lowerSubject}`;
    const hasCalendarIntent = CALENDAR_KEYWORDS.some((kw) => textToCheck.includes(kw));
    setShowCalendarPrompt(hasCalendarIntent && body.length > 10);
  }, [body, subject]);

  // Reset on initial values change
  useEffect(() => {
    setTo(initialTo);
    setSubject(initialSubject);
    setBody(initialBody);
  }, [initialTo, initialSubject, initialBody]);

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) return;
    setSending(true);
    try {
      await onSend(to, subject, body);

      // If calendar prompt was shown and user filled it, create event too
      if (showCalendarPrompt && calendarDetails.date && onCreateEvent) {
        await onCreateEvent({
          summary: subject,
          startDateTime: `${calendarDetails.date}T${calendarDetails.startTime}:00`,
          endDateTime: `${calendarDetails.date}T${calendarDetails.endTime}:00`,
          attendees: to.split(",").map((e) => e.trim()),
        });
      }

      onClose();
      setTo("");
      setSubject("");
      setBody("");
    } catch {
      // Error handling via toast
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  if (minimized) {
    return (
      <div className="fixed bottom-0 right-6 z-50 animate-slide-up">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold cursor-pointer"
          style={{
            background: "rgb(var(--bg-elevated))",
            color: "rgb(var(--text-primary))",
            border: "1px solid rgba(var(--border-primary))",
            borderBottom: "none",
            boxShadow: "var(--shadow-dropdown)",
          }}
        >
          <Send className="size-3.5" />
          {subject || "New Message"}
          <X
            className="size-3.5 ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 animate-fade-in" style={{ background: "rgba(0, 0, 0, 0.4)", backdropFilter: "blur(2px)" }} />

      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden animate-scale-in flex flex-col max-h-[80vh]"
        style={{
          background: "rgb(var(--bg-elevated))",
          border: "1px solid rgba(var(--border-primary))",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "rgba(var(--border-primary))" }}
        >
          <h3 className="font-semibold text-sm" style={{ color: "rgb(var(--text-primary))" }}>
            New Message
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized(true)}
              className="size-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "rgb(var(--text-secondary))" }}
              title="Minimize"
            >
              <Minus className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="size-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "rgb(var(--text-secondary))" }}
              title="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="flex-1 overflow-y-auto">
          <div className="border-b px-5 py-2" style={{ borderColor: "rgba(var(--border-secondary))" }}>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-8 shrink-0" style={{ color: "rgb(var(--text-secondary))" }}>To</label>
              <input
                ref={toInputRef}
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 bg-transparent text-sm focus:outline-none py-1"
                style={{ color: "rgb(var(--text-primary))" }}
              />
            </div>
          </div>

          <div className="border-b px-5 py-2" style={{ borderColor: "rgba(var(--border-secondary))" }}>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium w-8 shrink-0" style={{ color: "rgb(var(--text-secondary))" }}>Subj</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="flex-1 bg-transparent text-sm font-medium focus:outline-none py-1"
                style={{ color: "rgb(var(--text-primary))" }}
              />
            </div>
          </div>

          <div className="px-5 py-3">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message..."
              rows={10}
              className="w-full bg-transparent text-sm leading-relaxed resize-none focus:outline-none"
              style={{ color: "rgb(var(--text-primary))" }}
            />
          </div>

          {/* Calendar-Aware Compose Banner */}
          {showCalendarPrompt && (
            <div
              className="mx-5 mb-3 rounded-xl border p-3 animate-slide-up"
              style={{
                borderColor: "rgba(var(--accent-purple), 0.3)",
                background: "rgba(var(--accent-purple), 0.05)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="size-4" style={{ color: "rgb(var(--accent-purple))" }} />
                <span className="text-xs font-semibold" style={{ color: "rgb(var(--accent-purple))" }}>
                  Meeting detected — Add a calendar invite?
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="date"
                  value={calendarDetails.date}
                  onChange={(e) =>
                    setCalendarDetails({ ...calendarDetails, date: e.target.value })
                  }
                  className="rounded-lg border px-2 py-1 text-xs focus:outline-none"
                  style={{
                    background: "rgb(var(--bg-primary))",
                    borderColor: "rgba(var(--border-primary))",
                    color: "rgb(var(--text-primary))",
                  }}
                />
                <input
                  type="time"
                  value={calendarDetails.startTime}
                  onChange={(e) =>
                    setCalendarDetails({ ...calendarDetails, startTime: e.target.value })
                  }
                  className="rounded-lg border px-2 py-1 text-xs focus:outline-none"
                  style={{
                    background: "rgb(var(--bg-primary))",
                    borderColor: "rgba(var(--border-primary))",
                    color: "rgb(var(--text-primary))",
                  }}
                />
                <span className="text-xs self-center" style={{ color: "rgb(var(--text-tertiary))" }}>to</span>
                <input
                  type="time"
                  value={calendarDetails.endTime}
                  onChange={(e) =>
                    setCalendarDetails({ ...calendarDetails, endTime: e.target.value })
                  }
                  className="rounded-lg border px-2 py-1 text-xs focus:outline-none"
                  style={{
                    background: "rgb(var(--bg-primary))",
                    borderColor: "rgba(var(--border-primary))",
                    color: "rgb(var(--text-primary))",
                  }}
                />
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: "rgb(var(--text-tertiary))" }}>
                A calendar event will be created and invite sent along with this email.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t"
          style={{ borderColor: "rgba(var(--border-primary))" }}
        >
          <div className="flex items-center gap-2">
            <button
              className="size-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ color: "rgb(var(--text-secondary))" }}
              title="Attach file"
            >
              <Paperclip className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={{
                borderColor: "rgba(var(--border-primary))",
                color: "rgb(var(--text-secondary))",
              }}
            >
              Discard
            </button>
            <button
              onClick={handleSend}
              disabled={!to.trim() || !subject.trim() || sending}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              style={{
                background: "rgb(var(--btn-primary-bg))",
                color: "rgb(var(--btn-primary-text))",
              }}
            >
              <Send className="size-3.5" />
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
