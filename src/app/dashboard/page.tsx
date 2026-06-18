"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Archive,
  Calendar,
  Clock,
  Mail,
  Moon,
  PenLine,
  Search,
  Settings,
  Sparkles,
  Star,
  Sun,
  Tag,
  Zap,
} from "lucide-react";

import { useEmails } from "@/hooks/useEmails";
import { useCalendar } from "@/hooks/useCalendar";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useTheme } from "@/hooks/useTheme";

import { ToastProvider, useToast } from "@/components/ui/Toast";
import Sidebar from "@/components/Sidebar";
import EmailList from "@/components/EmailList";
import EmailThread from "@/components/EmailThread";
import CalendarPanel from "@/components/CalendarPanel";
import ComposeModal from "@/components/ComposeModal";
import CommandPalette, { type Command } from "@/components/CommandPalette";
import SettingsModal from "@/components/SettingsModal";
import ShortcutsModal from "@/components/ShortcutsModal";

function MailOSApp() {
  // ── State ──
  const emailHook = useEmails();
  const calendarHook = useCalendar();
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();

  const [settings, setSettings] = useState({
    gmail: { clientId: "", clientSecret: "", connected: false, emailAddress: "" },
    googlecalendar: { clientId: "", clientSecret: "", connected: false },
  });

  const [currentUser, setCurrentUser] = useState<{ name: string; email: string } | null>(null);

  // ── Fetch current user ──
  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // ── Handle logout ──
  const handleLogout = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        window.location.href = "/login";
      }
    } catch {}
  }, []);

  // Modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState({ to: "", subject: "", body: "" });
  const [showEmailThread, setShowEmailThread] = useState(false);
  const [listWidth, setListWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        const newWidth = mouseMoveEvent.clientX - 200; // Sidebar is 200px
        if (newWidth > 260 && newWidth < 650) {
          setListWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    }
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // ── Fetch settings ──
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ── Settings save ──
  const handleSaveSettings = useCallback(
    async (data: {
      gmail: { clientId: string; clientSecret?: string };
      googlecalendar: { clientId: string; clientSecret?: string };
    }) => {
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (res.ok) {
          await fetchSettings();
          addToast({ message: "Settings saved successfully", type: "success" });
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [fetchSettings, addToast]
  );

  // ── OAuth connect ──
  const handleConnect = useCallback(async (plugin: "gmail" | "googlecalendar") => {
    try {
      const res = await fetch(`/api/auth/connect?plugin=${plugin}`);
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        addToast({
          message: data.error || `Failed to connect ${plugin}`,
          type: "error",
        });
      }
    } catch {
      addToast({ message: "Connection error", type: "error" });
    }
  }, [addToast]);

  const handleDisconnect = useCallback(
    async (plugin: "gmail" | "googlecalendar") => {
      try {
        const res = await fetch("/api/auth/disconnect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plugin }),
        });
        if (res.ok) {
          await fetchSettings();
          if (plugin === "gmail") {
            emailHook.refreshEmails();
          } else {
            calendarHook.refreshEvents();
          }
          addToast({
            message: `Disconnected ${plugin === "gmail" ? "Gmail" : "Google Calendar"}`,
            type: "success",
          });
        } else {
          const data = await res.json();
          addToast({
            message: data.error || `Failed to disconnect ${plugin}`,
            type: "error",
          });
        }
      } catch {
        addToast({ message: "Disconnection error", type: "error" });
      }
    },
    [fetchSettings, emailHook, calendarHook, addToast]
  );

  // ── Compose handlers ──
  const openCompose = useCallback(
    (initial?: { to: string; subject: string; body: string }) => {
      setComposeInitial(initial || { to: "", subject: "", body: "" });
      setIsComposeOpen(true);
    },
    []
  );

  const handleSendEmail = useCallback(
    async (to: string, subject: string, body: string) => {
      try {
        await emailHook.sendEmail(to, subject, body);
        addToast({ message: "Email sent successfully", type: "success" });
      } catch {
        addToast({ message: "Failed to send email", type: "error" });
        throw new Error("Failed");
      }
    },
    [emailHook, addToast]
  );

  // ── Email actions ──
  const handleArchive = useCallback(
    async (id: string) => {
      await emailHook.archiveEmail(id);
      addToast({
        message: "Email archived",
        type: "success",
        undoAction: () => {
          // Re-fetch to undo
          emailHook.refreshEmails();
        },
      });
    },
    [emailHook, addToast]
  );

  const handleStar = useCallback(
    async (id: string) => {
      await emailHook.starEmail(id);
    },
    [emailHook]
  );

  const handleReply = useCallback(
    async (id: string) => {
      // Open compose with reply context
      const email = emailHook.emails.find((e) => e.id === id);
      if (email) {
        openCompose({
          to: email.from,
          subject: `Re: ${email.subject}`,
          body: `\n\n---\nOn ${email.date}, ${email.from} wrote:\n> ${email.snippet}`,
        });
      }
    },
    [emailHook.emails, openCompose]
  );

  const handleSnooze = useCallback(
    (id: string) => {
      addToast({ message: "Snoozed until tomorrow morning", type: "info" });
    },
    [addToast]
  );

  // ── Select email and show thread ──
  const handleSelectEmail = useCallback(
    (id: string) => {
      emailHook.selectEmail(id);
      emailHook.markRead(id);
      setShowEmailThread(true);
    },
    [emailHook]
  );

  // ── Command Palette commands ──
  const commands: Command[] = useMemo(
    () => [
      {
        id: "compose",
        label: "Compose new email",
        description: "Open the compose window",
        icon: PenLine,
        category: "email",
        shortcut: "C",
        action: () => openCompose(),
      },
      {
        id: "reply",
        label: "Reply to current email",
        description: "Reply to the selected email",
        icon: Mail,
        category: "email",
        shortcut: "R",
        action: () => {
          if (emailHook.selectedEmailId) handleReply(emailHook.selectedEmailId);
        },
      },
      {
        id: "archive",
        label: "Archive this email",
        description: "Move the selected email to archive",
        icon: Archive,
        category: "email",
        shortcut: "E",
        action: () => {
          if (emailHook.selectedEmailId) handleArchive(emailHook.selectedEmailId);
        },
      },
      {
        id: "star",
        label: "Star / Unstar email",
        description: "Toggle star on selected email",
        icon: Star,
        category: "email",
        action: () => {
          if (emailHook.selectedEmailId) handleStar(emailHook.selectedEmailId);
        },
      },
      {
        id: "snooze",
        label: "Snooze email",
        description: "Snooze until later",
        icon: Clock,
        category: "email",
        shortcut: "S",
        action: () => {
          if (emailHook.selectedEmailId) handleSnooze(emailHook.selectedEmailId);
        },
      },
      {
        id: "new-event",
        label: "Create calendar event",
        description: "Add a new event to your calendar",
        icon: Calendar,
        category: "calendar",
        shortcut: "N",
        action: () => {
          addToast({ message: "Click + in the calendar panel to create an event", type: "info" });
        },
      },
      {
        id: "inbox",
        label: "Go to Inbox",
        icon: Mail,
        category: "navigation",
        action: () => emailHook.setActiveFolder("inbox"),
      },
      {
        id: "starred",
        label: "Go to Starred",
        icon: Star,
        category: "navigation",
        action: () => emailHook.setActiveFolder("starred"),
      },
      {
        id: "sent",
        label: "Go to Sent",
        icon: Mail,
        category: "navigation",
        action: () => emailHook.setActiveFolder("sent"),
      },
      {
        id: "settings",
        label: "Open Settings",
        description: "Configure Gmail & Calendar credentials",
        icon: Settings,
        category: "action",
        action: () => setIsSettingsOpen(true),
      },
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        description: "Toggle between dark and light themes",
        icon: theme === "dark" ? Sun : Moon,
        category: "action",
        shortcut: "⌘D",
        action: toggleTheme,
      },
      {
        id: "shortcuts",
        label: "Show keyboard shortcuts",
        description: "View all available shortcuts",
        icon: Zap,
        category: "action",
        shortcut: "?",
        action: () => setIsShortcutsOpen(true),
      },
      {
        id: "refresh",
        label: "Refresh inbox",
        description: "Re-fetch emails and calendar events",
        icon: Search,
        category: "action",
        action: () => {
          emailHook.refreshEmails();
          calendarHook.refreshEvents();
          addToast({ message: "Refreshing...", type: "info" });
        },
      },
      {
        id: "ai-summarize",
        label: "Summarize this thread",
        description: "Get an AI summary of the selected email",
        icon: Sparkles,
        category: "ai",
        action: () => {
          // Focus the AI agent input — it lives in CalendarPanel
          const aiInput = document.querySelector('#ai-chat-form textarea') as HTMLTextAreaElement;
          if (aiInput) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
            nativeInputValueSetter.call(aiInput, 'Summarize my latest emails');
            aiInput.dispatchEvent(new Event('input', { bubbles: true }));
            aiInput.focus();
            addToast({ message: "AI Agent ready — press Enter to summarize", type: "info" });
          }
        },
      },
      {
        id: "ai-draft-reply",
        label: "Draft a reply with AI",
        description: "Let AI write a response to this email",
        icon: Sparkles,
        category: "ai",
        action: () => {
          const selectedEmail = emailHook.selectedEmail;
          const aiInput = document.querySelector('#ai-chat-form textarea') as HTMLTextAreaElement;
          if (aiInput) {
            const prompt = selectedEmail
              ? `Draft a professional reply to the email from "${selectedEmail.from}" about "${selectedEmail.subject}"`
              : "Draft a reply to my latest email";
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
            nativeInputValueSetter.call(aiInput, prompt);
            aiInput.dispatchEvent(new Event('input', { bubbles: true }));
            aiInput.focus();
            addToast({ message: "AI Agent ready — press Enter to draft reply", type: "info" });
          }
        },
      },
    ],
    [
      emailHook.selectedEmailId,
      theme,
      openCompose,
      handleReply,
      handleArchive,
      handleStar,
      handleSnooze,
      toggleTheme,
      emailHook,
      calendarHook,
      addToast,
    ]
  );

  // ── Keyboard Shortcuts ──
  useKeyboard([
    {
      key: "k",
      meta: true,
      handler: () => setIsCommandPaletteOpen(true),
      global: true,
    },
    {
      key: "j",
      handler: () => emailHook.selectNext(),
    },
    {
      key: "k",
      handler: () => emailHook.selectPrevious(),
    },
    {
      key: "Enter",
      handler: () => {
        if (emailHook.selectedEmailId) {
          emailHook.markRead(emailHook.selectedEmailId);
          setShowEmailThread(true);
        }
      },
    },
    {
      key: "r",
      handler: () => {
        if (emailHook.selectedEmailId) handleReply(emailHook.selectedEmailId);
      },
    },
    {
      key: "e",
      handler: () => {
        if (emailHook.selectedEmailId) handleArchive(emailHook.selectedEmailId);
      },
    },
    {
      key: "s",
      handler: () => {
        if (emailHook.selectedEmailId) handleSnooze(emailHook.selectedEmailId);
      },
    },
    {
      key: "c",
      handler: () => openCompose(),
    },
    {
      key: "?",
      handler: () => setIsShortcutsOpen(true),
    },
    {
      key: "Escape",
      handler: () => {
        if (isCommandPaletteOpen) setIsCommandPaletteOpen(false);
        else if (isComposeOpen) setIsComposeOpen(false);
        else if (isShortcutsOpen) setIsShortcutsOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (showEmailThread) setShowEmailThread(false);
      },
      global: true,
    },
    {
      key: "d",
      meta: true,
      handler: toggleTheme,
      global: true,
    },
  ]);

  return (
    <div className="relative">
      <div
        className="w-full h-screen max-w-screen overflow-hidden flex flex-col transition-colors"
        style={{ background: "rgb(var(--bg-primary))", color: "rgb(var(--text-primary))" }}
      >
        {/* Demo Mode Banner */}
        {(!settings.gmail.connected || !settings.googlecalendar.connected) && (
          <div
            className="border-b px-6 py-2 flex items-center justify-between gap-4 text-xs shrink-0 animate-fade-in"
            style={{
              background: "rgb(var(--bg-secondary))",
              borderColor: "rgba(var(--border-secondary))",
            }}
          >
            <div className="flex items-center gap-2" style={{ color: "rgb(var(--text-secondary))" }}>
              <Sparkles className="size-3.5 animate-pulse" style={{ color: "rgb(var(--accent-yellow))" }} />
              <span>
                You are viewing MailOS in <strong>Demo Mode</strong>. Connect your real accounts for live syncing.
              </span>
            </div>
            <div className="flex items-center gap-3">
              {!settings.gmail.connected && (
                <button
                  onClick={() => handleConnect("gmail")}
                  className="px-2.5 py-1 rounded-md transition-colors text-xs font-medium"
                  style={{
                    background: "rgb(var(--bg-tertiary))",
                    color: "rgb(var(--text-primary))",
                  }}
                >
                  Connect Gmail
                </button>
              )}
              {!settings.googlecalendar.connected && (
                <button
                  onClick={() => handleConnect("googlecalendar")}
                  className="px-2.5 py-1 rounded-md transition-colors text-xs font-medium"
                  style={{
                    background: "rgb(var(--bg-tertiary))",
                    color: "rgb(var(--text-primary))",
                  }}
                >
                  Connect Calendar
                </button>
              )}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="underline decoration-dotted"
                style={{ color: "rgb(var(--text-secondary))" }}
              >
                Configure credentials
              </button>
            </div>
          </div>
        )}

        {/* Main Layout */}
        <div className="flex w-full flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <Sidebar
            activeFolder={emailHook.activeFolder}
            onFolderChange={(folder) => {
              emailHook.setActiveFolder(folder);
              setShowEmailThread(false);
            }}
            onComposeClick={() => openCompose()}
            onSettingsClick={() => setIsSettingsOpen(true)}
            emails={emailHook.emails}
            settings={settings}
            theme={theme}
            onToggleTheme={toggleTheme}
            currentUser={currentUser}
            onLogout={handleLogout}
          />

          {/* Email List */}
          <div 
            className={`flex flex-col min-w-[260px] h-full min-h-0 overflow-hidden shrink-0 border-r ${showEmailThread ? "hide-mobile" : "flex-1"}`} 
            style={{ 
              width: showEmailThread ? `${listWidth}px` : undefined,
              borderColor: "rgba(var(--border-primary))"
            }}
          >
            <EmailList
              emails={emailHook.filteredEmails}
              selectedEmailId={emailHook.selectedEmailId}
              onSelectEmail={handleSelectEmail}
              activeTab={emailHook.activeTab}
              onTabChange={emailHook.setActiveTab}
              loading={emailHook.loading}
              onCommandPaletteOpen={() => setIsCommandPaletteOpen(true)}
            />
          </div>

          {/* Resize Handle */}
          {showEmailThread && (
            <div
              className="w-1 cursor-col-resize hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors shrink-0 select-none"
              style={{
                background: isResizing ? "rgb(var(--accent-purple))" : "rgba(var(--border-primary))"
              }}
              onMouseDown={startResizing}
            />
          )}

          {/* Email Thread (shows when an email is selected) */}
          {showEmailThread && (
            <div className="flex-1 min-w-0 flex flex-col h-full border-r" style={{ borderColor: "rgba(var(--border-primary))" }}>
              <EmailThread
                email={emailHook.selectedEmail}
                onBack={() => setShowEmailThread(false)}
                onReply={handleReply}
                onArchive={handleArchive}
                onStar={handleStar}
                onSnooze={handleSnooze}
                onCompose={openCompose}
              />
            </div>
          )}

          {/* Calendar Panel */}
          <CalendarPanel
            events={calendarHook.events}
            selectedDate={calendarHook.selectedDate}
            navigatedDate={calendarHook.navigatedDate}
            selectedDateEvents={calendarHook.selectedDateEvents}
            calendarCells={calendarHook.calendarCells}
            loading={calendarHook.loading}
            onSelectDate={calendarHook.handleSelectDate}
            onPrevMonth={calendarHook.handlePrevMonth}
            onNextMonth={calendarHook.handleNextMonth}
            onCreateEvent={calendarHook.createEvent}
          />
        </div>
      </div>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSend={handleSendEmail}
        onCreateEvent={calendarHook.createEvent}
        initialTo={composeInitial.to}
        initialSubject={composeInitial.subject}
        initialBody={composeInitial.body}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commands}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings as any}
        onSave={handleSaveSettings}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}

// Wrap with ToastProvider
export default function App() {
  return (
    <ToastProvider>
      <MailOSApp />
    </ToastProvider>
  );
}
