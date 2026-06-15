"use client";

import { useEffect, useCallback, useRef } from "react";

type ShortcutHandler = () => void;

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: ShortcutHandler;
  /** If true, shortcut fires even when an input/textarea is focused */
  global?: boolean;
}

/**
 * Global keyboard shortcut registry.
 * Prevents firing when user is typing in inputs/textareas unless `global` is set.
 * Supports modifier keys (Ctrl/Meta + key combos).
 */
export function useKeyboard(shortcuts: ShortcutConfig[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    for (const shortcut of shortcutsRef.current) {
      const keyMatch =
        e.key.toLowerCase() === shortcut.key.toLowerCase();

      const ctrlMatch = shortcut.ctrl
        ? e.ctrlKey || e.metaKey
        : true;

      const metaMatch = shortcut.meta
        ? e.metaKey || e.ctrlKey
        : true;

      const shiftMatch = shortcut.shift ? e.shiftKey : true;

      // If shortcut requires a modifier, make sure we're not matching bare keys
      const needsModifier = shortcut.ctrl || shortcut.meta;
      const hasModifier = e.ctrlKey || e.metaKey;

      if (needsModifier && !hasModifier) continue;
      if (!needsModifier && hasModifier) continue;

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
        // Skip non-global shortcuts when user is in an input
        if (isInput && !shortcut.global) continue;

        e.preventDefault();
        e.stopPropagation();
        shortcut.handler();
        return;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);
}
