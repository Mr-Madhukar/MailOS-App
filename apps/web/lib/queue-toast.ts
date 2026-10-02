type QueueToastItem = {
  status: string;
  kind: string;
};

const QUEUE_MESSAGES: Record<string, { approved: string; pending: string }> = {
  email_send: {
    approved: "Email sent via Gmail",
    pending: "Added to approval queue",
  },
  email_draft: {
    approved: "Draft saved to Gmail",
    pending: "Draft queued for review",
  },
  draft_send: {
    approved: "Draft sent via Gmail",
    pending: "Draft send queued — approve in Queue",
  },
  calendar_invite: {
    approved: "Calendar invite sent",
    pending: "Invite queued — approve in Queue",
  },
  meeting_bundle: {
    approved: "Meeting invite and email sent",
    pending: "Meeting queued — approve in Queue",
  },
  calendar_archive: {
    approved: "Event rescheduled on Calendar",
    pending: "Reschedule queued — confirm in Queue",
  },
  calendar_delete: {
    approved: "Event removed from Calendar",
    pending: "Delete queued — approve in Queue",
  },
  calendar_update: {
    approved: "Event details updated on Calendar",
    pending: "Event update queued — approve in Queue",
  },
};

export function queueResultMessage(item: QueueToastItem): { title: string; queued: boolean } {
  const approved = item.status === "approved";
  const messages = QUEUE_MESSAGES[item.kind] ?? {
    approved: "Action completed",
    pending: "Added to approval queue",
  };

  return {
    title: approved ? messages.approved : messages.pending,
    queued: !approved,
  };
}
