"use client";

import { Calendar, Mail, X } from "lucide-react";

export type AgentFocusState = {
  threadId?: string;
  eventId?: string;
  threadLabel?: string;
  eventLabel?: string;
};

type AgentFocusChipProps = {
  focus: AgentFocusState;
  onClearAction: () => void;
  disabled?: boolean;
};

export function AgentFocusChip({ focus, onClearAction, disabled }: Readonly<AgentFocusChipProps>) {
  if (!focus.threadId && !focus.eventId) return null;

  const isThread = Boolean(focus.threadId);
  const Icon = isThread ? Mail : Calendar;
  const label = isThread
    ? focus.threadLabel?.trim() || "Email thread"
    : focus.eventLabel?.trim() || "Calendar event";

  return (
    <output className="thread-agent-focus-chip" aria-label={`Focused on ${label}`}>
      <Icon size={13} aria-hidden />
      <span className="thread-agent-focus-chip-label" title={label}>
        {label}
      </span>
      <button
        type="button"
        className="thread-agent-focus-chip-clear"
        onClick={onClearAction}
        disabled={disabled}
        aria-label="Remove focus"
        title="Remove focus"
      >
        <X size={12} />
      </button>
    </output>
  );
}
