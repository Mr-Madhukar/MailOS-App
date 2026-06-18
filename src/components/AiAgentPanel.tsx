"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Mail,
  Calendar,
  Search,
  Archive,
  Star,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Tool call display names and icons
const TOOL_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  send_email: { label: "Sending Email", icon: Mail, color: "rgb(var(--accent-green))" },
  create_event: { label: "Creating Event", icon: Calendar, color: "rgb(var(--accent-purple))" },
  list_emails: { label: "Fetching Emails", icon: Mail, color: "rgb(var(--accent-blue))" },
  list_events: { label: "Fetching Events", icon: Calendar, color: "rgb(var(--accent-blue))" },
  search_emails: { label: "Searching Emails", icon: Search, color: "rgb(var(--accent-yellow))" },
  archive_email: { label: "Archiving Email", icon: Archive, color: "rgb(var(--accent-yellow))" },
  star_email: { label: "Starring Email", icon: Star, color: "rgb(var(--accent-yellow))" },
};

const QUICK_ACTIONS = [
  "What's on my calendar today?",
  "Summarize my latest emails",
  "Draft a reply to the latest email",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    state: "call" | "result";
    args?: any;
    result?: any;
  }>;
}

interface AiAgentPanelProps {
  onTriggerAction?: (action: string, data?: any) => void;
}

export default function AiAgentPanel({ onTriggerAction }: AiAgentPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // Expand when user starts chatting
  useEffect(() => {
    if (messages.length > 0) {
      setIsExpanded(true);
    }
  }, [messages.length]);

  // Send message to the AI
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text.trim(),
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setError(null);
      setIsLoading(true);

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }

      // Abort previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errorData.error || `HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error("No response body");
        }

        // Read the UIMessage streaming response (SSE format)
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantContent = "";
        const toolCalls: NonNullable<ChatMessage["toolCalls"]> = [];
        const assistantId = `assistant-${Date.now()}`;
        let buffer = "";

        const updateAssistant = () => {
          setMessages([
            ...updatedMessages,
            {
              id: assistantId,
              role: "assistant",
              content: assistantContent,
              toolCalls: toolCalls.map((tc) => ({ ...tc })),
            },
          ]);
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            let trimmed = line.trim();
            if (!trimmed) continue;

            // SSE format: lines start with "data: " — strip the prefix
            if (trimmed.startsWith("data: ")) {
              trimmed = trimmed.slice(6);
            } else if (trimmed.startsWith("data:")) {
              trimmed = trimmed.slice(5);
            } else if (trimmed.startsWith("event:") || trimmed.startsWith(":")) {
              // SSE comments or event type lines — skip
              continue;
            }

            if (!trimmed || trimmed === "[DONE]") continue;

            // Try to parse as JSON (UIMessage stream sends JSON objects)
            try {
              const chunk = JSON.parse(trimmed);

              switch (chunk.type) {
                case "text-delta": {
                  assistantContent += chunk.delta || "";
                  updateAssistant();
                  break;
                }
                case "tool-input-available": {
                  const existing = toolCalls.find(
                    (tc) => tc.toolCallId === chunk.toolCallId
                  );
                  if (!existing) {
                    toolCalls.push({
                      toolCallId: chunk.toolCallId,
                      toolName: chunk.toolName,
                      state: "call",
                      args: chunk.input,
                    });
                    updateAssistant();
                  }
                  break;
                }
                case "tool-output-available": {
                  const tc = toolCalls.find(
                    (tc) => tc.toolCallId === chunk.toolCallId
                  );
                  if (tc) {
                    tc.state = "result";
                    tc.result = chunk.output;
                    updateAssistant();
                  }
                  break;
                }
                case "tool-output-error":
                case "tool-input-error": {
                  const tc2 = toolCalls.find(
                    (tc) => tc.toolCallId === chunk.toolCallId
                  );
                  if (tc2) {
                    tc2.state = "result";
                    tc2.result = { success: false, error: chunk.errorText || "Tool error" };
                    updateAssistant();
                  }
                  break;
                }
                case "error": {
                  setError(chunk.errorText || "AI error");
                  break;
                }
                // text-start, text-end, reasoning-* etc — ignore
              }
            } catch {
              // Unparseable line — skip silently
            }
          }
        }

        // Final update
        setMessages([
          ...updatedMessages,
          {
            id: assistantId,
            role: "assistant",
            content: assistantContent,
            toolCalls: [...toolCalls],
          },
        ]);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("AI Chat Error:", err);
        setError(err.message || "Something went wrong");
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, isLoading]
  );

  // Handle quick action clicks
  const handleQuickAction = useCallback(
    (action: string) => {
      sendMessage(action);
    },
    [sendMessage]
  );

  // Handle form submit
  const handleFormSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [sendMessage, input]
  );

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [sendMessage, input]
  );

  // Auto-resize textarea
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const textarea = e.target;
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    },
    []
  );

  // Render tool invocation status
  const renderToolCall = (tc: NonNullable<ChatMessage["toolCalls"]>[0]) => {
    const meta = TOOL_META[tc.toolName] || {
      label: tc.toolName,
      icon: Sparkles,
      color: "rgb(var(--accent-purple))",
    };
    const isComplete = tc.state === "result";
    const isSuccess = tc.result?.success !== false;

    return (
      <div
        key={tc.toolCallId}
        className="flex items-start gap-2.5 rounded-lg border px-3 py-2 my-1.5 text-xs transition-all"
        style={{
          borderColor: "rgba(var(--border-secondary))",
          background: "rgba(var(--bg-tertiary), 0.4)",
        }}
      >
        <div
          className="size-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: `${meta.color}20` }}
        >
          {isComplete ? (
            isSuccess ? (
              <CheckCircle2 className="size-3.5" style={{ color: "rgb(var(--accent-green))" }} />
            ) : (
              <AlertCircle className="size-3.5" style={{ color: "rgb(239, 68, 68)" }} />
            )
          ) : (
            <Loader2 className="size-3.5 animate-spin" style={{ color: meta.color }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium" style={{ color: "rgb(var(--text-primary))" }}>
            {isComplete
              ? isSuccess
                ? meta.label.replace("ing ", "ed ").replace("Sending", "Sent").replace("Creating", "Created").replace("Fetching", "Fetched").replace("Searching", "Searched")
                : `${meta.label} failed`
              : meta.label + "..."}
          </p>
          {isComplete && tc.result?.message && (
            <p className="mt-0.5 opacity-70" style={{ color: "rgb(var(--text-secondary))" }}>
              {tc.result.message}
            </p>
          )}
          {isComplete && tc.result?.error && (
            <p className="mt-0.5" style={{ color: "rgb(239, 68, 68)" }}>
              {tc.result.error}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="border-t flex flex-col transition-all duration-300"
      style={{
        borderColor: "rgba(var(--border-primary))",
        maxHeight: isExpanded ? "60vh" : "auto",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 pt-3 pb-2 cursor-pointer select-none"
        onClick={() => {
          if (messages.length > 0) setIsExpanded(!isExpanded);
        }}
      >
        <p
          className="font-semibold uppercase text-xs leading-4 tracking-wider flex items-center gap-1.5"
          style={{ color: "rgb(var(--text-secondary))" }}
        >
          <Sparkles className="size-3" style={{ color: "rgb(var(--text-primary))" }} />
          AI Agent
        </p>
        {messages.length > 0 && (
          <button
            className="size-5 rounded flex items-center justify-center transition-colors"
            style={{ color: "rgb(var(--text-secondary))" }}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronUp className="size-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Messages Area */}
      {isExpanded && messages.length > 0 && (
        <div
          className="flex-1 overflow-y-auto px-3 space-y-3 min-h-0 scroll-smooth"
          style={{ maxHeight: "calc(60vh - 110px)" }}
        >
          {messages.map((message) => (
            <div key={message.id} className="animate-fade-in">
              {message.role === "user" ? (
                <div className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-xl rounded-br-sm px-3 py-2 text-xs leading-relaxed"
                    style={{
                      background: "rgb(var(--btn-primary-bg))",
                      color: "rgb(var(--btn-primary-text))",
                    }}
                  >
                    {message.content}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div
                    className="size-5 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: "rgba(var(--accent-purple), 0.15)" }}
                  >
                    <Sparkles className="size-3" style={{ color: "rgb(var(--accent-purple))" }} />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Tool calls */}
                    {message.toolCalls?.map((tc) => renderToolCall(tc))}
                    {/* Text content */}
                    {message.content && (
                      <div
                        className="text-xs leading-relaxed whitespace-pre-wrap"
                        style={{ color: "rgb(var(--text-primary))" }}
                      >
                        {message.content}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && !messages[messages.length - 1]?.content && (
            <div className="flex gap-2 animate-fade-in">
              <div
                className="size-5 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "rgba(var(--accent-purple), 0.15)" }}
              >
                <Sparkles
                  className="size-3 animate-pulse"
                  style={{ color: "rgb(var(--accent-purple))" }}
                />
              </div>
              <div className="flex items-center gap-1 py-1.5">
                <span
                  className="size-1.5 rounded-full animate-bounce"
                  style={{ background: "rgb(var(--text-secondary))", animationDelay: "0ms" }}
                />
                <span
                  className="size-1.5 rounded-full animate-bounce"
                  style={{ background: "rgb(var(--text-secondary))", animationDelay: "150ms" }}
                />
                <span
                  className="size-1.5 rounded-full animate-bounce"
                  style={{ background: "rgb(var(--text-secondary))", animationDelay: "300ms" }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                color: "rgb(239, 68, 68)",
              }}
            >
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Quick actions — show when no messages yet */}
      {messages.length === 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleQuickAction(action)}
              className="text-[10px] leading-4 px-2 py-1 rounded-md border transition-all hover:scale-[1.02]"
              style={{
                borderColor: "rgba(var(--border-secondary))",
                color: "rgb(var(--text-secondary))",
                background: "rgba(var(--bg-tertiary), 0.3)",
              }}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <form id="ai-chat-form" onSubmit={handleFormSubmit} className="px-3 pb-3 pt-1">
        <div
          className="flex items-end gap-2 rounded-xl border px-3 py-2 transition-all focus-within:ring-1"
          style={{
            background: "rgba(var(--bg-tertiary), 0.6)",
            borderColor: "rgba(var(--border-primary))",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask the AI agent anything..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-xs leading-5 resize-none focus:outline-none placeholder:opacity-40 disabled:opacity-50"
            style={{
              color: "rgb(var(--text-primary))",
              maxHeight: "120px",
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="size-7 shrink-0 rounded-lg flex justify-center items-center transition-all disabled:opacity-30 hover:scale-105 active:scale-95"
            style={{
              background: input.trim()
                ? "rgb(var(--btn-primary-bg))"
                : "rgba(var(--bg-tertiary))",
              color: input.trim()
                ? "rgb(var(--btn-primary-text))"
                : "rgb(var(--text-secondary))",
            }}
          >
            {isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </button>
        </div>
        <p
          className="text-[9px] mt-1.5 text-center opacity-40"
          style={{ color: "rgb(var(--text-secondary))" }}
        >
          Press Enter to send · Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}
