"use client";

import { useState, useEffect, useCallback } from "react";

export type EmailPriority = "high" | "med" | "low";

export interface Email {
  id: string;
  from: string;
  to?: string;
  subject: string;
  snippet: string;
  body?: string;
  date: string;
  priority: EmailPriority;
  unread: boolean;
  labelIds: string[];
  threadId?: string;
}

export type MailTab = "all" | "priority" | "newsletters" | "updates";
export type Folder =
  | "inbox"
  | "starred"
  | "sent"
  | "drafts"
  | "archive"
  | "urgent"
  | "work"
  | "personal";

interface UseEmailsReturn {
  emails: Email[];
  filteredEmails: Email[];
  selectedEmailId: string | null;
  selectedEmail: Email | null;
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  activeTab: MailTab;
  activeFolder: Folder;
  isDemo: boolean;
  setActiveTab: (tab: MailTab) => void;
  setActiveFolder: (folder: Folder) => void;
  selectEmail: (id: string) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  archiveEmail: (id: string) => Promise<void>;
  starEmail: (id: string) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  sendEmail: (to: string, subject: string, body: string) => Promise<void>;
  replyToEmail: (id: string, body: string) => Promise<void>;
  refreshEmails: () => Promise<void>;
}

export function useEmails(): UseEmailsReturn {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MailTab>("all");
  const [activeFolder, setActiveFolder] = useState<Folder>("inbox");
  const [isDemo, setIsDemo] = useState(true);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/emails");
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
        setIsDemo(data.demo ?? true);
        // Auto-select first email
        if (data.emails?.length > 0 && !selectedEmailId) {
          setSelectedEmailId(data.emails[0].id);
        }
      } else {
        setError("Failed to fetch emails");
      }
    } catch {
      setError("Failed to fetch emails");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Fetch full email body when an email is selected
  useEffect(() => {
    if (!selectedEmailId) return;

    const current = emails.find((e) => e.id === selectedEmailId);
    if (current && current.body) return; // Already loaded

    const fetchBody = async () => {
      try {
        const res = await fetch(`/api/emails/${selectedEmailId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.email) {
            setEmails((prev) =>
              prev.map((e) =>
                e.id === selectedEmailId ? { ...e, ...data.email } : e
              )
            );
          }
        }
      } catch (err) {
        console.error("Failed to fetch email body:", err);
      }
    };

    fetchBody();
  }, [selectedEmailId, emails]);

  // Filter logic
  const filteredEmails = emails
    .filter((email) => {
      if (activeFolder === "inbox") return email.labelIds?.includes("INBOX");
      if (activeFolder === "starred") return email.labelIds?.includes("STARRED");
      if (activeFolder === "sent") return email.labelIds?.includes("SENT");
      if (activeFolder === "drafts") return email.labelIds?.includes("DRAFT");
      if (activeFolder === "archive")
        return (
          !email.labelIds?.includes("INBOX") &&
          !email.labelIds?.includes("SENT") &&
          !email.labelIds?.includes("DRAFT")
        );
      if (activeFolder === "urgent") return email.priority === "high";
      if (activeFolder === "work")
        return (
          email.priority === "med" ||
          email.subject?.toLowerCase().includes("work") ||
          email.from?.toLowerCase().includes("work")
        );
      if (activeFolder === "personal")
        return (
          email.priority === "low" ||
          email.subject?.toLowerCase().includes("personal") ||
          email.from?.toLowerCase().includes("personal")
        );
      return true;
    })
    .filter((email) => {
      if (activeTab === "priority")
        return email.priority === "high" || email.priority === "med";
      if (activeTab === "newsletters")
        return (
          email.subject?.toLowerCase().includes("newsletter") ||
          email.from?.toLowerCase().includes("newsletter")
        );
      if (activeTab === "updates") return email.priority === "low";
      return true;
    });

  const selectedIndex = filteredEmails.findIndex(
    (e) => e.id === selectedEmailId
  );
  const selectedEmail =
    filteredEmails.find((e) => e.id === selectedEmailId) || null;

  const selectNext = useCallback(() => {
    if (filteredEmails.length === 0) return;
    const currentIdx = filteredEmails.findIndex(
      (e) => e.id === selectedEmailId
    );
    const nextIdx = Math.min(currentIdx + 1, filteredEmails.length - 1);
    setSelectedEmailId(filteredEmails[nextIdx].id);
  }, [filteredEmails, selectedEmailId]);

  const selectPrevious = useCallback(() => {
    if (filteredEmails.length === 0) return;
    const currentIdx = filteredEmails.findIndex(
      (e) => e.id === selectedEmailId
    );
    const prevIdx = Math.max(currentIdx - 1, 0);
    setSelectedEmailId(filteredEmails[prevIdx].id);
  }, [filteredEmails, selectedEmailId]);

  const archiveEmail = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/emails/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive" }),
        });
        // Optimistic update
        setEmails((prev) =>
          prev.map((e) =>
            e.id === id
              ? { ...e, labelIds: e.labelIds.filter((l) => l !== "INBOX") }
              : e
          )
        );
      } catch {
        // Silently fail in demo mode
      }
    },
    []
  );

  const starEmail = useCallback(async (id: string) => {
    try {
      await fetch(`/api/emails/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "star" }),
      });
      setEmails((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                labelIds: e.labelIds.includes("STARRED")
                  ? e.labelIds.filter((l) => l !== "STARRED")
                  : [...e.labelIds, "STARRED"],
              }
            : e
        )
      );
    } catch {}
  }, []);

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/emails/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead" }),
      });
      setEmails((prev) =>
        prev.map((e) => (e.id === id ? { ...e, unread: false } : e))
      );
    } catch {}
  }, []);

  const sendEmail = useCallback(
    async (to: string, subject: string, body: string) => {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      if (!res.ok) throw new Error("Failed to send email");
      await fetchEmails();
    },
    [fetchEmails]
  );

  const replyToEmail = useCallback(
    async (id: string, body: string) => {
      const res = await fetch(`/api/emails/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      await fetchEmails();
    },
    [fetchEmails]
  );

  return {
    emails,
    filteredEmails,
    selectedEmailId,
    selectedEmail,
    selectedIndex,
    loading,
    error,
    activeTab,
    activeFolder,
    isDemo,
    setActiveTab,
    setActiveFolder,
    selectEmail: setSelectedEmailId,
    selectNext,
    selectPrevious,
    archiveEmail,
    starEmail,
    markRead,
    sendEmail,
    replyToEmail,
    refreshEmails: fetchEmails,
  };
}
