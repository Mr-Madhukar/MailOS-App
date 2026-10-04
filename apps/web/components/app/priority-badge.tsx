"use client";

import { categoryLabel, urgencyDisplay } from "~/lib/priority-display";
import type { InboxPriorityCategory, InboxUrgency } from "@repo/services/ai/inbox-priority";

type Props = {
  urgency: InboxUrgency;
  score?: number;
  reason?: string;
  category?: InboxPriorityCategory;
  rank?: number;
  compact?: boolean;
};

function getPriorityTooltip(reason?: string, score?: number): string | undefined {
  if (reason) {
    if (score != null) {
      return `${reason} (${Math.round(score)})`;
    }
    return reason;
  }
  if (score != null) {
    return `Score: ${score}`;
  }
  return undefined;
}

export function PriorityBadge({ urgency, score, reason, category, rank, compact }: Readonly<Props>) {
  const display = urgencyDisplay(urgency);
  const tooltip = getPriorityTooltip(reason, score);

  return (
    <span className="thread-priority-badge-wrap" title={tooltip}>
      {rank != null ? <span className="thread-priority-rank">#{rank}</span> : null}
      <span
        className="thread-priority-badge"
        data-tone={display.tone}
        style={{
          color: display.color,
          background: display.bg,
          borderColor: display.border,
        }}
      >
        {display.shortLabel}
      </span>
      {!compact && category ? (
        <span className="thread-priority-category">{categoryLabel(category)}</span>
      ) : null}
    </span>
  );
}

export function PriorityReason({ reason }: Readonly<{ reason: string }>) {
  return <p className="thread-priority-reason">{reason}</p>;
}
