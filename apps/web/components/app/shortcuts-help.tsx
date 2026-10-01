"use client";

const SHORTCUTS = [
  { keys: "Ctrl+K", action: "Open command palette" },
  { keys: "?", action: "Show keyboard shortcuts" },
  { keys: "j / k", action: "Move selection (inbox)" },
  { keys: "Enter", action: "Open selected thread" },
  { keys: "/", action: "Focus inbox search" },
  { keys: "e", action: "Archive thread (inbox)" },
  { keys: "A / D", action: "Approve / dismiss first queue item" },
  { keys: "Esc", action: "Close pane or modal" },
];

type ShortcutsHelpProps = Readonly<{
  open: boolean;
  onCloseAction: () => void;
}>;

export function ShortcutsHelp({ open, onCloseAction }: ShortcutsHelpProps) {
  if (!open) return null;

  return (
    <dialog
      open
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      className="thread-cmdk-overlay"
      onCancel={(e) => {
        e.preventDefault();
        onCloseAction();
      }}
    >
      <button
        type="button"
        className="thread-cmdk-backdrop-btn"
        aria-label="Close shortcuts"
        tabIndex={-1}
        onClick={onCloseAction}
        style={{
          position: "fixed",
          inset: 0,
          border: "none",
          background: "transparent",
          cursor: "default",
        }}
      />
      <div className="thread-cmdk" style={{ maxWidth: 420, position: "relative", zIndex: 1 }}>
        <div className="thread-cmdk-input" style={{ borderBottom: "1px solid var(--thread-line)" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Keyboard shortcuts</span>
          <span className="thread-app-kbd">?</span>
        </div>
        <div className="thread-cmdk-list" style={{ padding: "8px 0" }}>
          {SHORTCUTS.map((row) => (
            <div
              key={row.keys}
              className="thread-cmdk-item"
              style={{ cursor: "default", justifyContent: "space-between" }}
            >
              <span>{row.action}</span>
              <kbd className="thread-app-kbd">{row.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </dialog>
  );
}
