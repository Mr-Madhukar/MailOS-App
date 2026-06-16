"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Command,
  Key,
  Mail,
  Calendar,
  Check,
  ChevronRight,
  ExternalLink,
  Sun,
  Moon,
  Loader2,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

/* ────────────────────────────────────────────────────────
   Types & Data
   ──────────────────────────────────────────────────────── */

interface StepInfo {
  id: string;
  title: string;
  icon: React.ElementType;
}

const STEPS: StepInfo[] = [
  { id: "credentials", title: "Credentials", icon: Key },
  { id: "gmail", title: "Gmail", icon: Mail },
  { id: "calendar", title: "Calendar", icon: Calendar },
];

const GMAIL_PERMISSIONS = [
  "Read, compose, send and manage your email",
  "Create and edit email filters and settings",
  "Access contacts saved in your account",
];

const CALENDAR_PERMISSIONS = [
  "View and edit events on all your calendars",
  "Create new events and send invites",
  "See calendar free/busy information",
];

/* ────────────────────────────────────────────────────────
   Inner Component (uses useSearchParams)
   ──────────────────────────────────────────────────────── */

function SignupFlow() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── State ──
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  // Credential inputs
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // Connection status
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);

  // ── Check current status on mount ──
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const hasCreds = !!data.gmail.clientId;
        const gmailOk = data.gmail.connected;
        const calendarOk = data.googlecalendar?.connected;

        setCredentialsSaved(hasCreds);
        setGmailConnected(gmailOk);
        setCalendarConnected(calendarOk);

        // Auto-determine step
        if (calendarOk && gmailOk) setCurrentStep(3);
        else if (gmailOk) setCurrentStep(2);
        else if (hasCreds) setCurrentStep(1);
        else setCurrentStep(0);
      }
    } catch {
      // API might fail if DB not ready — start at step 0
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // ── Handle ?connected= query param (OAuth callback return) ──
  useEffect(() => {
    const connected = searchParams.get("connected");
    if (connected === "gmail") {
      setGmailConnected(true);
      setCredentialsSaved(true);
      setCurrentStep(2);
      // Clean URL
      window.history.replaceState({}, "", "/signup");
    } else if (connected === "googlecalendar") {
      setCalendarConnected(true);
      setGmailConnected(true);
      setCredentialsSaved(true);
      setCurrentStep(3);
      window.history.replaceState({}, "", "/signup");
    }
  }, [searchParams]);

  // ── Save credentials (single set for both Gmail + Calendar) ──
  const handleSaveCredentials = useCallback(async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError("Both Client ID and Client Secret are required.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmail: { clientId: clientId.trim(), clientSecret: clientSecret.trim() },
          googlecalendar: { clientId: clientId.trim(), clientSecret: clientSecret.trim() },
        }),
      });
      if (res.ok) {
        setCredentialsSaved(true);
        setCurrentStep(1);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save credentials.");
      }
    } catch {
      setError("Network error. Make sure the database is running.");
    }
    setSaving(false);
  }, [clientId, clientSecret]);

  // ── Connect via OAuth ──
  const handleConnect = useCallback(async (plugin: "gmail" | "googlecalendar") => {
    setError("");
    setConnecting(true);
    try {
      const res = await fetch(`/api/auth/connect?plugin=${plugin}&from=signup`);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || `Failed to start ${plugin} OAuth.`);
        setConnecting(false);
      }
    } catch {
      setError("Network error.");
      setConnecting(false);
    }
  }, []);

  // ── Loading state ──
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "rgb(var(--bg-primary))" }}
      >
        <Loader2
          className="w-6 h-6 animate-spin"
          style={{ color: "rgb(var(--accent-purple))" }}
        />
      </div>
    );
  }

  // ── Complete state ──
  const isComplete = currentStep >= 3;

  return (
    <div
      className="min-h-screen transition-colors flex flex-col"
      style={{
        background: "rgb(var(--bg-primary))",
        color: "rgb(var(--text-primary))",
      }}
    >
      {/* ── Top Bar ── */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "0.5px solid rgba(var(--border-primary))" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "rgb(var(--accent-purple))" }}
          >
            <Command className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-semibold">MailOS</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ color: "rgb(var(--text-secondary))" }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link
            href="/dashboard"
            className="text-xs"
            style={{ color: "rgb(var(--text-tertiary))" }}
          >
            Skip to dashboard →
          </Link>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

          {/* ── Progress Stepper ── */}
          {!isComplete && (
            <div className="flex items-center justify-center gap-2 mb-10">
              {STEPS.map((step, idx) => {
                const done = idx < currentStep;
                const active = idx === currentStep;
                return (
                  <div key={step.id} className="flex items-center gap-2">
                    {idx > 0 && (
                      <div
                        className="w-8 h-px"
                        style={{
                          background: done
                            ? "rgb(var(--accent-purple))"
                            : "rgba(var(--border-primary))",
                        }}
                      />
                    )}
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all"
                        style={{
                          background: done
                            ? "rgb(var(--accent-green))"
                            : active
                              ? "rgb(var(--accent-purple))"
                              : "rgba(var(--surface-glass-hover))",
                          color: done || active ? "#fff" : "rgb(var(--text-tertiary))",
                        }}
                      >
                        {done ? <Check className="w-3 h-3" /> : idx + 1}
                      </div>
                      <span
                        className="text-xs hidden sm:inline"
                        style={{
                          color: active
                            ? "rgb(var(--text-primary))"
                            : "rgb(var(--text-tertiary))",
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {step.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════════════ STEP 0: CREDENTIALS ═══════════════ */}
          {currentStep === 0 && (
            <div
              className="rounded-xl p-6 sm:p-8 animate-fade-in"
              style={{
                border: "0.5px solid rgba(var(--border-primary))",
                background: "rgb(var(--bg-secondary))",
              }}
            >
              <div className="text-center mb-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(124, 106, 247, 0.12)" }}
                >
                  <Key className="w-6 h-6" style={{ color: "rgb(var(--accent-purple))" }} />
                </div>
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ letterSpacing: "-0.5px" }}
                >
                  Connect your Google account
                </h2>
                <p
                  className="text-sm max-w-sm mx-auto"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  Enter your Google Cloud OAuth credentials to get started.
                  One set works for both Gmail and Calendar.
                </p>
              </div>

              {/* Setup Guide Link */}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg mb-6 text-xs transition-colors"
                style={{
                  background: "rgba(var(--surface-glass))",
                  border: "0.5px solid rgba(var(--border-primary))",
                  color: "rgb(var(--accent-purple))",
                }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Need help? Open Google Cloud Console to create credentials
                <ChevronRight className="w-3.5 h-3.5 ml-auto" />
              </a>

              {/* Inputs */}
              <div className="space-y-4 mb-6">
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "rgb(var(--text-secondary))" }}
                  >
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="123456789-abc.apps.googleusercontent.com"
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={{
                      background: "rgb(var(--bg-tertiary))",
                      border: "0.5px solid rgba(var(--border-primary))",
                      color: "rgb(var(--text-primary))",
                      focusRingColor: "rgb(var(--accent-purple))",
                    }}
                  />
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: "rgb(var(--text-secondary))" }}
                  >
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
                    className="w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                    style={{
                      background: "rgb(var(--bg-tertiary))",
                      border: "0.5px solid rgba(var(--border-primary))",
                      color: "rgb(var(--text-primary))",
                    }}
                  />
                </div>
              </div>

              {/* Redirect URI hint */}
              <div
                className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs mb-6"
                style={{
                  background: "rgba(var(--surface-glass))",
                  border: "0.5px solid rgba(var(--border-primary))",
                  color: "rgb(var(--text-secondary))",
                }}
              >
                <ShieldCheck
                  className="w-3.5 h-3.5 shrink-0 mt-0.5"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                />
                <span>
                  Set your Authorized Redirect URI to{" "}
                  <code
                    className="px-1 py-0.5 rounded text-[11px]"
                    style={{
                      background: "rgb(var(--bg-primary))",
                      border: "0.5px solid rgba(var(--border-primary))",
                      color: "rgb(var(--text-primary))",
                    }}
                  >
                    http://localhost:3000/api/auth/callback
                  </code>
                </span>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="text-xs px-3 py-2 rounded-lg mb-4"
                  style={{
                    background: "rgba(226, 75, 74, 0.1)",
                    color: "rgb(var(--accent-red))",
                    border: "0.5px solid rgba(226, 75, 74, 0.2)",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSaveCredentials}
                disabled={saving || !clientId.trim() || !clientSecret.trim()}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                style={{
                  background: "rgb(var(--accent-purple))",
                  color: "#fff",
                }}
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Continue <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ═══════════════ STEP 1: CONNECT GMAIL ═══════════════ */}
          {currentStep === 1 && (
            <div
              className="rounded-xl p-6 sm:p-8 animate-fade-in"
              style={{
                border: "0.5px solid rgba(var(--border-primary))",
                background: "rgb(var(--bg-secondary))",
              }}
            >
              <div className="text-center mb-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(226, 75, 74, 0.12)" }}
                >
                  <Mail className="w-6 h-6" style={{ color: "rgb(var(--accent-red))" }} />
                </div>
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ letterSpacing: "-0.5px" }}
                >
                  Connect Gmail
                </h2>
                <p
                  className="text-sm max-w-sm mx-auto"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  Allow MailOS to read, compose, and manage your email.
                  Your data is encrypted and never leaves your server.
                </p>
              </div>

              {/* Permissions list */}
              <div
                className="rounded-lg p-4 mb-6"
                style={{
                  background: "rgba(var(--surface-glass))",
                  border: "0.5px solid rgba(var(--border-primary))",
                }}
              >
                <div
                  className="text-[10px] uppercase font-semibold tracking-wider mb-3"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                >
                  MailOS will be able to
                </div>
                <ul className="space-y-2.5">
                  {GMAIL_PERMISSIONS.map((perm, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs">
                      <Check
                        className="w-3.5 h-3.5 shrink-0 mt-0.5"
                        style={{ color: "rgb(var(--accent-green))" }}
                      />
                      <span style={{ color: "rgb(var(--text-secondary))" }}>{perm}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="text-xs px-3 py-2 rounded-lg mb-4"
                  style={{
                    background: "rgba(226, 75, 74, 0.1)",
                    color: "rgb(var(--accent-red))",
                    border: "0.5px solid rgba(226, 75, 74, 0.2)",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Connect Button */}
              <button
                onClick={() => handleConnect("gmail")}
                disabled={connecting}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
                style={{
                  background: "rgb(var(--accent-purple))",
                  color: "#fff",
                }}
              >
                {connecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Google...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Mail className="w-4 h-4" /> Connect Gmail
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ═══════════════ STEP 2: CONNECT CALENDAR ═══════════════ */}
          {currentStep === 2 && (
            <div
              className="rounded-xl p-6 sm:p-8 animate-fade-in"
              style={{
                border: "0.5px solid rgba(var(--border-primary))",
                background: "rgb(var(--bg-secondary))",
              }}
            >
              {/* Gmail success banner */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg mb-6 text-xs"
                style={{
                  background: "rgba(29, 158, 117, 0.1)",
                  border: "0.5px solid rgba(29, 158, 117, 0.2)",
                  color: "rgb(var(--accent-green))",
                }}
              >
                <Check className="w-3.5 h-3.5" />
                Gmail connected successfully
              </div>

              <div className="text-center mb-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(55, 138, 221, 0.12)" }}
                >
                  <Calendar className="w-6 h-6" style={{ color: "rgb(var(--accent-blue))" }} />
                </div>
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ letterSpacing: "-0.5px" }}
                >
                  Connect Google Calendar
                </h2>
                <p
                  className="text-sm max-w-sm mx-auto"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  Sync your events and create meetings directly from MailOS.
                </p>
              </div>

              {/* Permissions list */}
              <div
                className="rounded-lg p-4 mb-6"
                style={{
                  background: "rgba(var(--surface-glass))",
                  border: "0.5px solid rgba(var(--border-primary))",
                }}
              >
                <div
                  className="text-[10px] uppercase font-semibold tracking-wider mb-3"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                >
                  MailOS will be able to
                </div>
                <ul className="space-y-2.5">
                  {CALENDAR_PERMISSIONS.map((perm, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs">
                      <Check
                        className="w-3.5 h-3.5 shrink-0 mt-0.5"
                        style={{ color: "rgb(var(--accent-green))" }}
                      />
                      <span style={{ color: "rgb(var(--text-secondary))" }}>{perm}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="text-xs px-3 py-2 rounded-lg mb-4"
                  style={{
                    background: "rgba(226, 75, 74, 0.1)",
                    color: "rgb(var(--accent-red))",
                    border: "0.5px solid rgba(226, 75, 74, 0.2)",
                  }}
                >
                  {error}
                </div>
              )}

              {/* Connect Button */}
              <button
                onClick={() => handleConnect("googlecalendar")}
                disabled={connecting}
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
                style={{
                  background: "rgb(var(--accent-purple))",
                  color: "#fff",
                }}
              >
                {connecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Google...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Calendar className="w-4 h-4" /> Connect Calendar
                  </span>
                )}
              </button>

              {/* Skip option */}
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full mt-3 py-2 text-xs transition-colors"
                style={{ color: "rgb(var(--text-tertiary))" }}
              >
                Skip for now — I&apos;ll connect later
              </button>
            </div>
          )}

          {/* ═══════════════ STEP 3: COMPLETE ═══════════════ */}
          {isComplete && (
            <div
              className="rounded-xl p-6 sm:p-10 text-center animate-fade-in"
              style={{
                border: "0.5px solid rgba(var(--border-primary))",
                background: "rgb(var(--bg-secondary))",
              }}
            >
              {/* Success icon */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(29, 158, 117, 0.12)" }}
              >
                <Sparkles className="w-8 h-8" style={{ color: "rgb(var(--accent-green))" }} />
              </div>

              <h2
                className="text-2xl font-bold mb-2"
                style={{ letterSpacing: "-0.8px" }}
              >
                You&apos;re all set!
              </h2>
              <p
                className="text-sm mb-8 max-w-xs mx-auto"
                style={{ color: "rgb(var(--text-secondary))" }}
              >
                Gmail and Calendar are connected. Your inbox is ready — press
                ⌘K to start.
              </p>

              {/* Connection status */}
              <div className="space-y-2 mb-8">
                <div
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg text-xs"
                  style={{
                    background: "rgba(var(--surface-glass))",
                    border: "0.5px solid rgba(var(--border-primary))",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" style={{ color: "rgb(var(--accent-red))" }} />
                    <span style={{ color: "rgb(var(--text-primary))" }}>Gmail</span>
                  </span>
                  <span
                    className="flex items-center gap-1"
                    style={{ color: "rgb(var(--accent-green))" }}
                  >
                    <Check className="w-3 h-3" /> Connected
                  </span>
                </div>
                <div
                  className="flex items-center justify-between px-4 py-2.5 rounded-lg text-xs"
                  style={{
                    background: "rgba(var(--surface-glass))",
                    border: "0.5px solid rgba(var(--border-primary))",
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" style={{ color: "rgb(var(--accent-blue))" }} />
                    <span style={{ color: "rgb(var(--text-primary))" }}>Google Calendar</span>
                  </span>
                  <span
                    className="flex items-center gap-1"
                    style={{ color: "rgb(var(--accent-green))" }}
                  >
                    <Check className="w-3 h-3" /> Connected
                  </span>
                </div>
              </div>

              {/* CTA */}
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "rgb(var(--accent-purple))",
                  color: "#fff",
                }}
              >
                Open MailOS
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Page (wrapped in Suspense for useSearchParams)
   ──────────────────────────────────────────────────────── */

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "rgb(var(--bg-primary))" }}
        >
          <Loader2
            className="w-6 h-6 animate-spin"
            style={{ color: "rgb(var(--accent-purple))" }}
          />
        </div>
      }
    >
      <SignupFlow />
    </Suspense>
  );
}
