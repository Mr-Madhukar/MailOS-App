"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Lock, Command, Sun, Moon, CheckCircle2, ArrowRight } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

function ResetPasswordForm() {
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="w-full max-w-[440px] animate-fade-in">
        <div className="rounded-2xl p-6 sm:p-8 shadow-2xl border text-center space-y-4"
             style={{ borderColor: "rgba(var(--accent-red), 0.2)", background: "rgb(var(--bg-secondary))" }}>
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-red-500"
               style={{ background: "rgba(var(--accent-red), 0.1)" }}>
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-red-500">Missing Reset Token</h2>
          <p className="text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
            The password reset link is invalid because it is missing the security token. Please request a new link.
          </p>
          <div className="pt-2">
            <Link
              href="/forgot-password"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg"
              style={{ background: "rgb(var(--accent-purple))", color: "#ffffff" }}
            >
              Request Reset Link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to reset password.");
      }

      setSuccess("Your password has been successfully reset!");
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
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
          Set new password
        </h1>
        <p className="text-sm text-center" style={{ color: "rgb(var(--text-secondary))" }}>
          Please choose a secure password for your account.
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
            <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-green-500"
                 style={{ background: "rgba(var(--accent-green), 0.1)" }}>
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-lg" style={{ color: "rgb(var(--text-primary))" }}>
                Password Updated
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "rgb(var(--text-secondary))" }}>
                Your password has been successfully assigned/updated. You can now log in using your email and password.
              </p>
            </div>

            <Link
              href="/login"
              className="w-full h-10 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: "rgb(var(--accent-purple))",
                color: "#ffffff",
              }}
            >
              Go to Log In
              <ArrowRight className="w-4 h-4" />
            </Link>
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

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold" style={{ color: "rgb(var(--text-secondary))" }}>
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center transition-colors"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold" style={{ color: "rgb(var(--text-secondary))" }}>
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                "Update Password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { theme, toggleTheme } = useTheme();

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

      <Suspense fallback={
        <div className="w-full max-w-[440px] flex flex-col items-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <span className="mt-2 text-xs" style={{ color: "rgb(var(--text-secondary))" }}>Loading...</span>
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
