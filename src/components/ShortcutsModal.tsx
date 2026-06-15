"use client";

import React from "react";
import { X } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["J"], description: "Next email" },
      { keys: ["K"], description: "Previous email" },
      { keys: ["Enter"], description: "Open selected email" },
      { keys: ["Escape"], description: "Close modal / Go back" },
    ],
  },
  {
    title: "Email Actions",
    shortcuts: [
      { keys: ["R"], description: "Reply" },
      { keys: ["G"], description: "Reply all" },
      { keys: ["E"], description: "Archive" },
      { keys: ["S"], description: "Snooze" },
      { keys: ["L"], description: "Label" },
      { keys: ["#"], description: "Delete" },
    ],
  },
  {
    title: "Compose",
    shortcuts: [
      { keys: ["C"], description: "New email" },
      { keys: ["N"], description: "New calendar event" },
      { keys: ["⌘", "Enter"], description: "Send email" },
    ],
  },
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Command palette" },
      { keys: ["?"], description: "Show shortcuts" },
      { keys: ["⌘", "D"], description: "Toggle dark/light mode" },
    ],
  },
];

export default function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 animate-fade-in" style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(4px)" }} />

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: "rgb(var(--bg-elevated))",
          border: "1px solid rgba(var(--border-primary))",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "rgba(var(--border-primary))" }}
        >
          <h3 className="font-semibold text-base" style={{ color: "rgb(var(--text-primary))" }}>
            Keyboard Shortcuts
          </h3>
          <button onClick={onClose} style={{ color: "rgb(var(--text-secondary))" }}>
            <X className="size-5" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-6">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h4
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                >
                  {group.title}
                </h4>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <React.Fragment key={key}>
                            {i > 0 && (
                              <span className="text-[10px]" style={{ color: "rgb(var(--text-tertiary))" }}>
                                +
                              </span>
                            )}
                            <kbd
                              className="text-[10px] px-1.5 py-0.5 rounded border font-mono min-w-[20px] text-center"
                              style={{
                                background: "rgb(var(--kbd-bg))",
                                borderColor: "rgba(var(--border-primary))",
                                color: "rgb(var(--text-secondary))",
                              }}
                            >
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="px-6 py-3 border-t text-center"
          style={{ borderColor: "rgba(var(--border-primary))" }}
        >
          <p className="text-[10px]" style={{ color: "rgb(var(--text-tertiary))" }}>
            Press <kbd className="px-1 rounded border font-mono" style={{ background: "rgb(var(--kbd-bg))", borderColor: "rgba(var(--border-secondary))" }}>?</kbd> anytime to show this overlay
          </p>
        </div>
      </div>
    </div>
  );
}
