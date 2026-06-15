"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
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
  X,
  Zap,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  category: "email" | "calendar" | "action" | "navigation" | "ai";
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  email: { label: "Email", icon: Mail },
  calendar: { label: "Calendar", icon: Calendar },
  action: { label: "Actions", icon: Zap },
  navigation: { label: "Navigation", icon: Search },
  ai: { label: "AI", icon: Sparkles },
};

export type { Command };

export default function CommandPalette({
  isOpen,
  onClose,
  commands,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Fuzzy-ish filter
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerQuery) ||
        cmd.description?.toLowerCase().includes(lowerQuery) ||
        cmd.category.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const result: Command[] = [];
    Object.values(grouped).forEach((cmds) => result.push(...cmds));
    return result;
  }, [grouped]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flatList[selectedIndex]) {
          flatList[selectedIndex].action();
          onClose();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, flatList, selectedIndex, onClose]);

  // Scroll selected into view
  useEffect(() => {
    const item = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 animate-fade-in" style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }} />

      {/* Palette */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: "rgb(var(--bg-elevated))",
          boxShadow: "var(--shadow-modal)",
          border: "1px solid rgba(var(--border-primary))",
        }}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b" style={{ borderColor: "rgba(var(--border-primary))" }}>
          <Search className="size-5 shrink-0" style={{ color: "rgb(var(--text-secondary))" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm font-medium focus:outline-none"
            style={{ color: "rgb(var(--text-primary))" }}
          />
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded border font-mono"
            style={{
              color: "rgb(var(--text-tertiary))",
              borderColor: "rgba(var(--border-primary))",
              background: "rgb(var(--kbd-bg))",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {flatList.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium" style={{ color: "rgb(var(--text-secondary))" }}>
                No commands found
              </p>
              <p className="text-xs mt-1" style={{ color: "rgb(var(--text-tertiary))" }}>
                Try a different search term
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, cmds]) => {
              const categoryMeta = CATEGORY_LABELS[category] || { label: category, icon: Zap };
              return (
                <div key={category}>
                  <div className="px-4 py-1.5">
                    <span
                      className="text-[10px] uppercase tracking-widest font-semibold"
                      style={{ color: "rgb(var(--text-tertiary))" }}
                    >
                      {categoryMeta.label}
                    </span>
                  </div>
                  {cmds.map((cmd) => {
                    const currentIndex = flatIndex++;
                    const isSelected = currentIndex === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        data-index={currentIndex}
                        onClick={() => {
                          cmd.action();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                        style={{
                          background: isSelected ? "rgba(var(--bg-hover))" : "transparent",
                        }}
                      >
                        <cmd.icon
                          className="size-4 shrink-0"
                          style={{ color: isSelected ? "rgb(var(--text-primary))" : "rgb(var(--text-secondary))" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: isSelected ? "rgb(var(--text-primary))" : "rgba(var(--text-primary), 0.85)" }}
                          >
                            {cmd.label}
                          </p>
                          {cmd.description && (
                            <p
                              className="text-xs truncate mt-0.5"
                              style={{ color: "rgb(var(--text-tertiary))" }}
                            >
                              {cmd.description}
                            </p>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd
                            className="text-[10px] px-1.5 py-0.5 rounded border font-mono shrink-0"
                            style={{
                              color: "rgb(var(--text-tertiary))",
                              borderColor: "rgba(var(--border-secondary))",
                              background: "rgb(var(--kbd-bg))",
                            }}
                          >
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 border-t flex items-center justify-between"
          style={{ borderColor: "rgba(var(--border-primary))" }}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[10px]" style={{ color: "rgb(var(--text-tertiary))" }}>
              <kbd className="px-1 rounded border font-mono" style={{ borderColor: "rgba(var(--border-secondary))", background: "rgb(var(--kbd-bg))" }}>↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1 text-[10px]" style={{ color: "rgb(var(--text-tertiary))" }}>
              <kbd className="px-1 rounded border font-mono" style={{ borderColor: "rgba(var(--border-secondary))", background: "rgb(var(--kbd-bg))" }}>↵</kbd>
              select
            </span>
          </div>
          <span className="text-[10px]" style={{ color: "rgb(var(--text-tertiary))" }}>
            {flatList.length} command{flatList.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
