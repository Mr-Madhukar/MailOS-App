"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Command, Sun, Moon, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export default function ForgotPasswordPage() {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setDevResetUrl(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to request password reset");
      }

      setSuccess("A password reset link has been generated!");
      if (data.resetUrl) {
        setDevResetUrl(data.resetUrl);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 transition-colors relative"
      style={{
        background: "rgb(var(--bg-primary))",
        color: "rgb(var(--text-primary))",
      }}
    >
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors border hover:bg-[rgba(var(--surface-glass-hover))]"
          style={{
            borderColor: "rgba(var(--border-primary))",
            background: "rgb(var(--bg-secondary))",
            color: "rgb(var(--text-secondary))",
          }}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-4.5 h-4.5" />
          ) : (
            <Moon className="w-4.5 h-4.5" />
          )}
        </button>
      </div>

      <div className="w-full max-w-[440px] animate-fade-in">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2 mb-8 justify-center">
          <img
            src="/android-chrome-192x192.png"
            alt="MailOS Logo"
            className="w-8 h-8 rounded-lg object-contain"
          />
          <span className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
            MailOS
          </span>
        </Link>

        {/* Title Block */}
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-3xl font-bold text-center tracking-tight mb-2" style={{ color: "rgb(var(--text-primary))" }}>
            Reset password
          </h1>
          <p className="text-sm text-center px-4" style={{ color: "rgb(var(--text-secondary))" }}>
            Enter your email address and we will generate a link to reset your password.
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border transition-all"
          style={{
            borderColor: "rgba(var(--border-primary))",
            background: "rgb(var(--bg-secondary))",
          }}
        >
          {success ? (
            <div className="space-y-6 text-center animate-scale-in">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center"
                   style={{ background: "rgba(var(--accent-green), 0.1)", color: "rgb(var(--accent-green))" }}>
                <CheckCircle2 className="w-6 h-6" />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-lg" style={{ color: "rgb(var(--text-primary))" }}>
                  Link Generated
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: "rgb(var(--text-secondary))" }}>
                  A secure password reset link has been successfully generated for <strong>{email}</strong>.
                </p>
              </div>

              {/* Dev Simulation Link Box */}
              {devResetUrl && (
                <div
                  className="p-4 rounded-xl border text-left space-y-3"
                  style={{
                    borderColor: "rgba(var(--accent-purple), 0.2)",
                    background: "linear-gradient(135deg, rgba(var(--accent-purple), 0.02) 0%, rgba(var(--surface-glass)) 100%)",
                  }}
                >
                  <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "rgb(var(--accent-purple))" }}>
                    Development Simulation
                  </div>
                  <p className="text-[11px]" style={{ color: "rgb(var(--text-secondary))" }}>
                    Since SMTP is not configured, you can click the button below to assign/reset your password:
                  </p>
                  <Link
                    href={devResetUrl}
                    className="block w-full text-center py-2 text-xs font-semibold rounded-lg transition-all"
                    style={{
                      background: "rgb(var(--accent-purple))",
                      color: "#ffffff",
                    }}
                  >
                    Go to Password Reset
                  </Link>
                </div>
              )}

              <div className="pt-4 border-t" style={{ borderColor: "rgba(var(--border-secondary))" }}>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Log In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  className="text-xs p-3 rounded-lg border text-red-500 animate-slide-down"
                  style={{
                    borderColor: "rgba(var(--accent-red), 0.2)",
                    background: "rgba(var(--accent-red), 0.08)",
                    color: "rgb(var(--accent-red))",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold" style={{ color: "rgb(var(--text-secondary))" }}>
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 pl-3.5 pr-10 text-sm rounded-lg border transition-all focus:outline-none"
                    style={{
                      background: "rgb(var(--bg-primary))",
                      borderColor: "rgba(var(--border-primary))",
                      color: "rgb(var(--text-primary))",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "rgb(var(--accent-purple))";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "rgba(var(--border-primary))";
                    }}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4" style={{ color: "rgb(var(--text-tertiary))" }} />
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all mt-6 hover:opacity-90 active:scale-[0.98]"
                style={{
                  background: "rgb(var(--accent-purple))",
                  color: "#ffffff",
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Reset Link
                  </>
                )}
              </button>

              {/* Footer Links */}
              <div className="mt-6 pt-4 border-t flex justify-center text-xs" style={{ borderColor: "rgba(var(--border-secondary))" }}>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 font-medium hover:underline"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Log In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
