"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Inbox,
  Calendar,
  Settings,
  PenLine,
  Send,
  Mail,
  ListChecks,
  CornerDownLeft,
  Bot,
  BarChart2,
  Keyboard,
  Sun,
  Mic,
  MicOff,
} from "lucide-react";

type CommandAction = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: typeof Inbox;
  run: () => void;
};

// ── Web Speech Recognition types ────────────────────────────────────────
type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
};

type SpeechRecognitionInstance = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition ??
    null
  );
}

export function ThreadCommand({
  open,
  onCloseAction,
  onShowShortcutsAction,
}: {
  open: boolean;
  onCloseAction: () => void;
  onShowShortcutsAction?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Voice state ─────────────────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setVoiceSupported(getSpeechRecognition() !== null);
  }, []);

  const actions = useMemo<CommandAction[]>(() => {
    const go = (path: string) => () => {
      router.push(path);
      onCloseAction();
    };
    return [
      { id: "brief", group: "Navigate", label: "Open daily brief", icon: Sun, run: go("/brief") },
      { id: "inbox", group: "Navigate", label: "Go to Inbox", icon: Inbox, run: go("/inbox") },
      { id: "search", group: "Navigate", label: "Search inbox", hint: "Press /", icon: Search, run: go("/inbox?focus=search") },
      { id: "queue", group: "Navigate", label: "Open approval queue", icon: ListChecks, run: go("/queue") },
      { id: "calendar", group: "Navigate", label: "Go to Calendar", icon: Calendar, run: go("/calendar") },
      { id: "agent", group: "Navigate", label: "Open Thread Agent", icon: Bot, run: go("/agent") },
      { id: "analytics", group: "Navigate", label: "Go to Analytics", icon: BarChart2, run: go("/analytics") },
      { id: "settings", group: "Navigate", label: "Go to Settings", icon: Settings, run: go("/settings") },
      { id: "compose", group: "Actions", label: "Compose new email", icon: PenLine, run: go("/inbox?compose=1") },
      { id: "compose-reply", group: "Actions", label: "Open inbox to reply", hint: "Inbox", icon: PenLine, run: go("/inbox") },
      { id: "approve", group: "Actions", label: "Review approval queue", icon: ListChecks, run: go("/queue") },
      { id: "invite", group: "Actions", label: "Send calendar invite", hint: "Calendar", icon: Send, run: go("/calendar") },
      { id: "connect", group: "Actions", label: "Connect Gmail", icon: Mail, run: go("/settings") },
      { id: "kbd-cmd", group: "Shortcuts", label: "Open command palette", hint: "Ctrl+K", icon: Search, run: onCloseAction },
      { id: "kbd-search", group: "Shortcuts", label: "Focus inbox search", hint: "/", icon: Search, run: go("/inbox?focus=search") },
      { id: "kbd-queue", group: "Shortcuts", label: "Go to approval queue", hint: "From anywhere", icon: ListChecks, run: go("/queue") },
      { id: "kbd-help", group: "Shortcuts", label: "Keyboard shortcuts", hint: "?", icon: Keyboard, run: () => { onCloseAction(); onShowShortcutsAction?.(); } },
    ];
  }, [router, onCloseAction, onShowShortcutsAction]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q));
  }, [actions, query]);

  // Auto-execute the first match when voice input settles on a confident result
  const voiceAutoExecRef = useRef(false);
  useEffect(() => {
    if (voiceAutoExecRef.current && filtered.length === 1) {
      voiceAutoExecRef.current = false;
      filtered[0]?.run();
    }
  }, [filtered]);

  // ── Voice toggle ────────────────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SR = getSpeechRecognition();
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from({ length: event.results.length })
        .map((_, i) => event.results[i]?.[0]?.transcript ?? "")
        .join("");
      setQuery(transcript);

      // If the final result is in, flag for auto-execute
      const lastResult = event.results[event.results.length - 1];
      if (lastResult?.isFinal) {
        voiceAutoExecRef.current = true;
      }
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
    setListening(true);
  }, [listening]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
      return () => {
        window.clearTimeout(id);
        document.body.style.overflow = "";
        // Stop any active recognition when closing
        recognitionRef.current?.abort();
        setListening(false);
      };
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCloseAction();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[active]?.run();
    }
  };

  let lastGroup = "";

  return (
    <div className="thread-cmdk-overlay" onClick={(e) => e.target === e.currentTarget && onCloseAction()}>
      <div className="thread-cmdk" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="thread-cmdk-input">
          <Search size={16} style={{ opacity: 0.5 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={listening ? "Listening…" : "Search commands…"}
            aria-label="Search commands"
          />
          {voiceSupported && (
            <button
              type="button"
              className={`thread-cmdk-voice${listening ? " thread-cmdk-voice--active" : ""}`}
              onClick={toggleVoice}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              title={listening ? "Stop listening" : "Voice command"}
            >
              {listening ? <MicOff size={15} /> : <Mic size={15} />}
            </button>
          )}
          <span className="thread-app-kbd">esc</span>
        </div>

        <div className="thread-cmdk-list">
          {filtered.length === 0 ? (
            <div className="thread-cmdk-empty">No commands found</div>
          ) : (
            filtered.map((a, i) => {
              const showGroup = a.group !== lastGroup;
              lastGroup = a.group;
              return (
                <div key={a.id}>
                  {showGroup && <div className="thread-cmdk-group">{a.group}</div>}
                  <button
                    type="button"
                    className="thread-cmdk-item"
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={a.run}
                  >
                    <a.icon size={15} />
                    <span>{a.label}</span>
                    {a.hint && <span className="thread-cmdk-item-hint">{a.hint}</span>}
                    {i === active && !a.hint && (
                      <CornerDownLeft size={13} className="thread-cmdk-item-hint" style={{ marginLeft: "auto" }} />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
