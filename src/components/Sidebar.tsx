"use client";

import React from "react";
import Link from "next/link";
import {
  Archive,
  Command,
  FileText,
  Mail,
  Moon,
  PenLine,
  Send,
  Settings,
  Star,
  Sun,
  LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Folder } from "@/hooks/useEmails";
import type { Email } from "@/hooks/useEmails";
import type { Theme } from "@/hooks/useTheme";

interface SidebarProps {
  activeFolder: Folder;
  onFolderChange: (folder: Folder) => void;
  onComposeClick: () => void;
  onSettingsClick: () => void;
  emails: Email[];
  settings: {
    gmail: { connected: boolean; emailAddress: string };
  };
  theme: Theme;
  onToggleTheme: () => void;
  currentUser?: { name: string; email: string } | null;
  onLogout?: () => void;
}

const NAV_ITEMS: {
  id: Folder;
  icon: React.ElementType;
  label: string;
  showCount?: boolean;
  countFilter?: (e: Email) => boolean;
}[] = [
  {
    id: "inbox",
    icon: Mail,
    label: "Inbox",
    showCount: true,
    countFilter: (e) => e.unread && (e.labelIds?.includes("INBOX") ?? false),
  },
  { id: "starred", icon: Star, label: "Starred" },
  { id: "sent", icon: Send, label: "Sent" },
  {
    id: "drafts",
    icon: FileText,
    label: "Drafts",
    showCount: true,
    countFilter: (e) => e.labelIds?.includes("DRAFT") ?? false,
  },
  { id: "archive", icon: Archive, label: "Archive" },
];

const LABELS: { id: Folder; label: string; color: string }[] = [
  { id: "urgent", label: "Urgent", color: "rgb(var(--accent-red))" },
  { id: "work", label: "Work", color: "rgb(var(--accent-orange))" },
  { id: "personal", label: "Personal", color: "rgb(var(--accent-green))" },
];

export default function Sidebar({
  activeFolder,
  onFolderChange,
  onComposeClick,
  onSettingsClick,
  emails,
  settings,
  theme,
  onToggleTheme,
  currentUser,
  onLogout,
}: SidebarProps) {
  const userName = currentUser?.name || (
    settings.gmail.connected && settings.gmail.emailAddress
      ? settings.gmail.emailAddress
          .split("@")[0]
          .split(/[._-]/)
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ")
      : "Madhukar"
  );

  const userEmail = currentUser?.email || (
    settings.gmail.connected && settings.gmail.emailAddress
      ? settings.gmail.emailAddress
      : "madhukardev@gmail.com"
  );

  const userInitials = userName
    .split(" ")
    .map((word: string) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "Mr";

  return (
    <aside className="sidebar-desktop shrink-0 border-r flex p-4 flex-col w-[200px] h-full min-h-0 overflow-hidden justify-between transition-colors" style={{ borderColor: "rgba(var(--border-primary))", background: "rgb(var(--bg-primary))" }}>
      <div className="flex flex-col">
        {/* Logo */}
        <Link href="/" className="flex px-2 pt-2 pb-4 items-center gap-2 hover:opacity-80 transition-opacity">
          <div
            className="size-7 rounded-lg flex justify-center items-center"
            style={{ background: "rgba(var(--text-primary), 0.1)", color: "rgb(var(--text-primary))" }}
          >
            <Command className="size-4" />
          </div>
          <span className="font-semibold text-lg leading-7 tracking-tight" style={{ color: "rgb(var(--text-primary))" }}>
            MailOS
          </span>
        </Link>

        {/* Compose Button */}
        <button
          onClick={onComposeClick}
          className="rounded-lg gap-2 w-full flex items-center justify-center h-9 px-4 py-2 text-sm font-medium transition-colors"
          style={{
            background: "rgb(var(--btn-primary-bg))",
            color: "rgb(var(--btn-primary-text))",
          }}
        >
          <PenLine className="size-4" />
          Compose
        </button>

        {/* Navigation */}
        <nav className="flex mt-6 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeFolder === item.id;
            const count = item.showCount && item.countFilter
              ? emails.filter(item.countFilter).length
              : 0;

            return (
              <button
                key={item.id}
                onClick={() => onFolderChange(item.id)}
                className="font-medium rounded-lg text-sm leading-5 flex px-3 py-2 justify-between items-center cursor-pointer transition-all"
                style={{
                  background: isActive ? "rgb(var(--bg-tertiary))" : "transparent",
                  color: isActive ? "rgb(var(--text-primary))" : "rgb(var(--text-secondary))",
                }}
              >
                <span className="flex items-center gap-3">
                  <item.icon className="size-4" />
                  {item.label}
                </span>
                {item.showCount && count > 0 && (
                  <span
                    className="font-semibold rounded-full text-xs leading-4 px-2 py-0.5"
                    style={{
                      background: isActive
                        ? "rgba(var(--text-primary), 0.15)"
                        : "rgb(var(--bg-tertiary))",
                      color: isActive
                        ? "rgb(var(--text-primary))"
                        : "rgb(var(--text-secondary))",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Labels */}
        <div className="mt-6 px-3">
          <p
            className="font-semibold uppercase text-xs leading-4 tracking-wider"
            style={{ color: "rgba(var(--text-secondary), 0.7)" }}
          >
            Labels
          </p>
          <div className="flex mt-3 flex-col gap-3">
            {LABELS.map((label) => (
              <button
                key={label.id}
                onClick={() => onFolderChange(label.id)}
                className="font-medium text-sm leading-5 flex items-center gap-3 w-full text-left transition-all"
                style={{
                  color:
                    activeFolder === label.id
                      ? "rgb(var(--text-primary))"
                      : "rgba(var(--text-primary), 0.7)",
                }}
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: label.color }}
                />
                {label.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-2">
        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ color: "rgb(var(--text-secondary))" }}
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ color: "rgb(var(--text-secondary))" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(var(--accent-red), 0.1)";
              e.currentTarget.style.color = "rgb(var(--accent-red))";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgb(var(--text-secondary))";
            }}
          >
            <LogOut className="size-4" style={{ color: "rgb(var(--accent-red))" }} />
            Sign Out
          </button>
        )}

        {/* User Profile */}
        <div
          onClick={onSettingsClick}
          className="rounded-lg flex p-2 items-center gap-3 cursor-pointer transition-colors border"
          style={{
            borderColor: "transparent",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgb(var(--bg-secondary))";
            e.currentTarget.style.borderColor = "rgba(var(--border-secondary))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = "transparent";
          }}
        >
          <Avatar className="size-9">
            <AvatarFallback
              className="font-semibold text-xs leading-4"
              style={{ background: "rgb(var(--bg-tertiary))", color: "rgb(var(--text-secondary))" }}
            >
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-sm leading-5" style={{ color: "rgb(var(--text-primary))" }}>
              {userName}
            </p>
            <p className="truncate text-xs leading-4" style={{ color: "rgb(var(--text-secondary))" }}>
              {userEmail}
            </p>
          </div>
          <Settings className="size-4" style={{ color: "rgb(var(--text-secondary))" }} />
        </div>
      </div>
    </aside>
  );
}
