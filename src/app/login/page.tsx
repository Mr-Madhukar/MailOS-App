"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Mail, Command, Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to log in");
      }

      // Hard redirect to dashboard to refresh router and middleware state
      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google");
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to initiate Google sign-in");
      }
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || "Could not start Google login");
      setGoogleLoading(false);
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
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgb(var(--accent-purple))" }}
          >
            <Command className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
            MailOS
          </span>
        </Link>

        {/* Title Block */}
        <div className="flex flex-col items-center mb-6">
          <h1 className="text-3xl font-bold text-center tracking-tight mb-2" style={{ color: "rgb(var(--text-primary))" }}>
            Welcome back
          </h1>
          <p className="text-sm text-center" style={{ color: "rgb(var(--text-secondary))" }}>
            Log in to your MailOS workspace to continue
          </p>
        </div>

        {/* Login Card */}
        <div
          className="rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border transition-all"
          style={{
            borderColor: "rgba(var(--border-primary))",
            background: "rgb(var(--bg-secondary))",
          }}
        >
          {/* Form */}
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
                Email
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

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold" style={{ color: "rgb(var(--text-secondary))" }}>
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium hover:underline text-right"
                  style={{ color: "rgb(var(--accent-purple))" }}
                >
                  Forgot password?
                </Link>
              </div>
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full h-10 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all mt-6 hover:opacity-90 active:scale-[0.98]"
              style={{
                background: "rgb(var(--accent-purple))",
                color: "#ffffff",
                opacity: loading || googleLoading ? 0.7 : 1,
                cursor: loading || googleLoading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                "Log In"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center justify-center">
            <div className="flex-grow border-t" style={{ borderColor: "rgba(var(--border-secondary))" }}></div>
            <span className="text-[10px] font-semibold uppercase tracking-widest px-3" style={{ color: "rgb(var(--text-tertiary))" }}>
              OR CONTINUE WITH
            </span>
            <div className="flex-grow border-t" style={{ borderColor: "rgba(var(--border-secondary))" }}></div>
          </div>

          {/* Continue with Google */}
          <button
            type="button"
            disabled={loading || googleLoading}
            onClick={handleGoogleLogin}
            className="w-full h-10 rounded-lg font-medium text-sm flex items-center justify-center gap-2 border transition-all hover:bg-[rgba(var(--surface-glass-hover))]"
            style={{
              background: "transparent",
              borderColor: "rgba(var(--border-primary))",
              color: "rgb(var(--text-primary))",
              cursor: loading || googleLoading ? "not-allowed" : "pointer",
              opacity: loading || googleLoading ? 0.7 : 1,
            }}
          >
            {googleLoading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-200 border-t-transparent" />
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Footer */}
          <div className="mt-6 text-center text-xs" style={{ color: "rgb(var(--text-secondary))" }}>
            Don't have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold hover:underline ml-1"
              style={{ color: "rgb(var(--accent-purple))" }}
            >
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
