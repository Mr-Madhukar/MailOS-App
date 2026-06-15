"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, X, Undo2, Info } from "lucide-react";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  undoAction?: () => void;
  duration?: number;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { ...toast, id }]);
      setTimeout(() => removeToast(id), toast.duration || 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto animate-toast-in flex items-center gap-3 px-4 py-3 rounded-xl glass-heavy shadow-lg max-w-sm"
          >
            {toast.type === "success" && (
              <CheckCircle className="size-4 shrink-0" style={{ color: "rgb(var(--accent-green))" }} />
            )}
            {toast.type === "error" && (
              <AlertCircle className="size-4 shrink-0" style={{ color: "rgb(var(--accent-red))" }} />
            )}
            {toast.type === "info" && (
              <Info className="size-4 shrink-0" style={{ color: "rgb(var(--accent-blue))" }} />
            )}
            <span className="text-sm font-medium flex-1" style={{ color: "rgb(var(--text-primary))" }}>
              {toast.message}
            </span>
            {toast.undoAction && (
              <button
                onClick={() => {
                  toast.undoAction?.();
                  removeToast(toast.id);
                }}
                className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition-colors"
                style={{
                  color: "rgb(var(--accent-purple))",
                  background: "rgba(var(--accent-purple), 0.1)",
                }}
              >
                <Undo2 className="size-3" />
                Undo
              </button>
            )}
            <button
              onClick={() => removeToast(toast.id)}
              className="size-5 flex items-center justify-center rounded transition-colors"
              style={{ color: "rgb(var(--text-tertiary))" }}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
