"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Command,
  Zap,
  Play,
  Mail,
  Inbox,
  Star,
  Send,
  FileText,
  Tag,
  Calendar,
  Search,
  Sparkles,
  Globe,
  Clock,
  ArrowRight,
  Sun,
  Moon,
  Menu,
  X,
  Terminal,
  Brain,
  CalendarClock,
  Bot,
  Webhook,
  SearchCode,
  CheckCircle2,
  CircleDot,
  Check,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import "./home.css";

/* ────────────────────────────────────────────────────────
   Mock Data
   ──────────────────────────────────────────────────────── */

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Keyboard shortcuts", href: "#shortcuts" },
  { label: "Integrations", href: "#how-it-works" },
];

const MOCK_EMAILS = [
  {
    initials: "AJ",
    initialsColor: "#7c6af7",
    sender: "Alex Johnson",
    subject: "Q3 roadmap alignment — We need to…",
    time: "10:42 AM",
    priority: "high" as const,
    unread: true,
  },
  {
    initials: "SC",
    initialsColor: "#1d9e75",
    sender: "Sarah Chen",
    subject: "Design system v2 feedback needed",
    time: "9:15 AM",
    priority: "med" as const,
    unread: true,
  },
  {
    initials: "MP",
    initialsColor: "#378add",
    sender: "Mike Peters",
    subject: "API integration update — The new…",
    time: "Yesterday",
    priority: "low" as const,
    unread: false,
  },
  {
    initials: "LW",
    initialsColor: "#ef9f27",
    sender: "Lisa Wang",
    subject: "Calendar: Team standup moved to 11",
    time: "Yesterday",
    priority: null,
    unread: false,
  },
  {
    initials: "DB",
    initialsColor: "#e24b4a",
    sender: "DevOps Bot",
    subject: "Deploy successful: main → production",
    time: "Mon",
    priority: null,
    unread: false,
  },
];

const MOCK_EVENTS = [
  { time: "10:00 AM", title: "Team standup", color: "#1d9e75" },
  { time: "2:00 PM", title: "1:1 with Sarah", color: "#378add" },
  { time: "4:30 PM", title: "Design review", color: "#7c6af7" },
];

const FEATURES = [
  {
    icon: Terminal,
    title: "⌘K Command palette",
    desc: "Navigate, search, compose, and execute any action from a single keyboard command. Never touch the mouse.",
    tag: "Productivity",
    color: "#7c6af7",
    bgColor: "rgba(124, 106, 247, 0.12)",
  },
  {
    icon: Brain,
    title: "AI priority inbox",
    desc: "Smart classification surfaces high-priority threads first. ML-powered labels auto-sort your inbox.",
    tag: "AI Powered",
    color: "#ef9f27",
    bgColor: "rgba(239, 159, 39, 0.12)",
  },
  {
    icon: CalendarClock,
    title: "Calendar-aware compose",
    desc: "Compose emails with your calendar in context. AI suggests meeting times based on mutual availability.",
    tag: "Smart Scheduling",
    color: "#1d9e75",
    bgColor: "rgba(29, 158, 117, 0.12)",
  },
  {
    icon: Bot,
    title: "Corsair MCP agent",
    desc: "Natural language commands to send emails, schedule meetings, and manage tasks — all through your AI agent.",
    tag: "Agent",
    color: "#378add",
    bgColor: "rgba(55, 138, 221, 0.12)",
  },
  {
    icon: Webhook,
    title: "Real-time webhooks",
    desc: "Instant push notifications and event-driven automation. Integrate with Slack, Discord, and 30+ services.",
    tag: "Integrations",
    color: "#20b2aa",
    bgColor: "rgba(32, 178, 170, 0.12)",
  },
  {
    icon: SearchCode,
    title: "Lightning-fast search",
    desc: "Full-text search across your entire inbox in under 100ms. Fuzzy matching, filters, and regex support.",
    tag: "Performance",
    color: "#e24b4a",
    bgColor: "rgba(226, 75, 74, 0.12)",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    num: 1,
    title: "Connect your accounts",
    desc: "Link Gmail and Google Calendar with a single OAuth click. Your data stays yours.",
  },
  {
    num: 2,
    title: "Open the command palette",
    desc: "Press ⌘K to access every action. Search emails, compose, navigate — all from one prompt.",
  },
  {
    num: 3,
    title: "Let the agent work",
    desc: "Tell Corsair MCP what you need in plain English. It drafts, schedules, and executes.",
  },
  {
    num: 4,
    title: "Review and approve",
    desc: "Every agent action is transparent. Review drafts, confirm meetings, then send with one key.",
  },
];

const SHORTCUTS = [
  { key: "⌘K", label: "Command palette" },
  { key: "J / K", label: "Navigate emails" },
  { key: "R", label: "Reply to email" },
  { key: "E", label: "Archive thread" },
  { key: "C", label: "Compose new" },
  { key: "S", label: "Snooze email" },
  { key: "N", label: "New event" },
  { key: "?", label: "Show shortcuts" },
];

const STATS = [
  { value: "8×", label: "faster than Gmail" },
  { value: "~100ms", label: "search latency" },
  { value: "30+", label: "keyboard shortcuts" },
  { value: "1", label: "command for everything" },
];

const PRICING_PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For individuals getting started with keyboard-first email.",
    color: "rgb(var(--text-secondary))",
    borderColor: "rgba(var(--border-primary))",
    popular: false,
    cta: "Start for free",
    features: [
      "1 Gmail account",
      "Basic keyboard shortcuts",
      "Command palette (⌘K)",
      "Calendar view (read-only)",
      "5 AI actions / day",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    desc: "For power users who need full control and unlimited AI.",
    color: "rgb(var(--accent-purple))",
    borderColor: "rgb(var(--accent-purple))",
    popular: true,
    cta: "Get Pro",
    features: [
      "3 Gmail accounts",
      "All 30+ keyboard shortcuts",
      "Corsair MCP agent (unlimited)",
      "Calendar sync + event creation",
      "Unlimited AI actions",
      "Priority search (<100ms)",
      "Real-time webhooks",
      "Priority support",
    ],
  },
  {
    name: "Team",
    price: "$29",
    period: "/user/month",
    desc: "For teams that collaborate on email and scheduling.",
    color: "rgb(var(--accent-blue))",
    borderColor: "rgba(var(--border-primary))",
    popular: false,
    cta: "Contact sales",
    features: [
      "Unlimited Gmail accounts",
      "Shared team inbox",
      "Corsair MCP agent (team-wide)",
      "Calendar sync for all members",
      "Admin dashboard & analytics",
      "Custom webhook integrations",
      "SSO & SAML",
      "Dedicated account manager",
    ],
  },
];

/* ────────────────────────────────────────────────────────
   Intersection Observer Hook
   ──────────────────────────────────────────────────────── */

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("hp-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ────────────────────────────────────────────────────────
   HOMEPAGE COMPONENT
   ──────────────────────────────────────────────────────── */

export default function HomePage() {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check authentication status
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(!!data.user);
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      }
    }
    checkAuth();
  }, []);

  // Track scroll for navbar style
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Section refs for reveal animations
  const heroRef = useReveal();
  const previewRef = useReveal();
  const statsRef = useReveal();
  const featuresRef = useReveal();
  const howRef = useReveal();
  const shortcutsRef = useReveal();
  const pricingRef = useReveal();
  const ctaRef = useReveal();

  return (
    <div
      className="min-h-screen transition-colors"
      style={{
        background: "rgb(var(--bg-primary))",
        color: "rgb(var(--text-primary))",
      }}
    >
      {/* ═══════════════ 1. NAVBAR ═══════════════ */}
      <nav
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          background: scrolled
            ? "rgba(var(--bg-primary), 0.85)"
            : "rgba(var(--bg-primary), 0.6)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: scrolled
            ? "0.5px solid rgba(var(--border-primary))"
            : "0.5px solid transparent",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/home" className="flex items-center gap-2 shrink-0">
              <img
                src="/android-chrome-192x192.png"
                alt="MailOS Logo"
                className="w-7 h-7 rounded-lg object-contain"
              />
              <span className="text-base font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
                MailOS
              </span>
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="hp-nav-link text-sm"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "rgb(var(--text-secondary))" }}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              {/* Sign In / Dashboard - Desktop */}
              {isAuthenticated !== null && (
                isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg hp-btn-primary animate-fade-in"
                    style={{
                      background: "rgb(var(--accent-purple))",
                      color: "#fff",
                    }}
                  >
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm rounded-lg hp-btn-ghost animate-fade-in"
                      style={{
                        color: "rgb(var(--text-secondary))",
                        border: "0.5px solid rgba(var(--border-primary))",
                      }}
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg hp-btn-primary animate-fade-in"
                      style={{
                        background: "rgb(var(--accent-purple))",
                        color: "#fff",
                      }}
                    >
                      Get started free
                    </Link>
                  </>
                )
              )}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ color: "rgb(var(--text-secondary))" }}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-4.5 h-4.5" />
                ) : (
                  <Menu className="w-4.5 h-4.5" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <div
            className={`md:hidden hp-mobile-menu ${mobileMenuOpen ? "hp-mobile-open" : ""}`}
            style={{
              background: "rgb(var(--bg-secondary))",
              borderRadius: "12px",
              border: "0.5px solid rgba(var(--border-primary))",
              marginBottom: mobileMenuOpen ? "12px" : "0",
              padding: mobileMenuOpen ? "12px" : "0",
              maxHeight: mobileMenuOpen ? "300px" : "0",
              overflow: "hidden",
            }}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm rounded-lg transition-colors"
                style={{ color: "rgb(var(--text-secondary))" }}
              >
                {link.label}
              </a>
            ))}
            <div
              className="mt-2 pt-2 flex flex-col gap-2"
              style={{ borderTop: "0.5px solid rgba(var(--border-primary))" }}
            >
              {isAuthenticated !== null && (
                isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    className="block px-3 py-2 text-sm font-medium rounded-lg text-center"
                    style={{ background: "rgb(var(--accent-purple))", color: "#fff" }}
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="block px-3 py-2 text-sm rounded-lg text-center"
                      style={{
                        color: "rgb(var(--text-secondary))",
                        border: "0.5px solid rgba(var(--border-primary))",
                      }}
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      className="block px-3 py-2 text-sm font-medium rounded-lg text-center"
                      style={{ background: "rgb(var(--accent-purple))", color: "#fff" }}
                    >
                      Get started free
                    </Link>
                  </>
                )
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════════ 2. HERO ═══════════════ */}
      <section ref={heroRef} className="hp-reveal hp-section">
        <div className="max-w-2xl mx-auto text-center">
          {/* Badge Pill */}
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium mb-8"
            style={{
              background: "rgba(var(--surface-glass))",
              border: "0.5px solid rgba(var(--border-primary))",
              color: "rgb(var(--text-secondary))",
            }}
          >
            <span
              className="w-2 h-2 rounded-full hp-pulse-dot"
              style={{ background: "rgb(var(--accent-green))" }}
            />
            Now with AI agent — powered by Corsair MCP
          </div>

          {/* H1 */}
          <h1
            className="text-4xl sm:text-5xl font-bold leading-tight mb-5"
            style={{
              letterSpacing: "-1.5px",
              color: "rgb(var(--text-primary))",
            }}
          >
            Email & calendar,
            <br />
            <span style={{ color: "rgb(var(--accent-purple))" }}>
              the way you work
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-base leading-relaxed mb-8 max-w-md mx-auto"
            style={{ color: "rgb(var(--text-secondary))" }}
          >
            A keyboard-first command center for Gmail and Google Calendar.
            <br />
            Powered by AI, built for people who ship.
          </p>

          {/* Buttons */}
          <div className="flex items-center justify-center gap-3 mb-5">
            {isAuthenticated !== null && (
              isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg hp-btn-primary"
                  style={{
                    background: "rgb(var(--accent-purple))",
                    color: "#fff",
                  }}
                >
                  <Zap className="w-4 h-4" />
                  Go to Dashboard
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg hp-btn-primary"
                  style={{
                    background: "rgb(var(--accent-purple))",
                    color: "#fff",
                  }}
                >
                  <Zap className="w-4 h-4" />
                  Start for free
                </Link>
              )
            )}
            <button
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg hp-btn-ghost"
              style={{
                color: "rgb(var(--text-secondary))",
                border: "0.5px solid rgba(var(--border-primary))",
              }}
            >
              <Play className="w-4 h-4" />
              Watch demo
            </button>
          </div>

          {/* Fine Print */}
          <p
            className="text-xs"
            style={{ color: "rgb(var(--text-tertiary))" }}
          >
            No credit card required · Works with Gmail · Google Calendar sync
            included
          </p>
        </div>
      </section>

      {/* ═══════════════ 3. APP PREVIEW ═══════════════ */}
      <section ref={previewRef} className="hp-reveal px-4 sm:px-6 pb-16">
        <div className="max-w-5xl mx-auto">
          <div
            className="rounded-2xl overflow-hidden hp-float"
            style={{
              border: "0.5px solid rgba(var(--border-primary))",
              background: "rgb(var(--bg-secondary))",
            }}
          >
            {/* Fake Title Bar */}
            <div
              className="flex items-center px-4 py-3 gap-3"
              style={{
                borderBottom: "0.5px solid rgba(var(--border-primary))",
                background: "rgb(var(--bg-tertiary))",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: "#e24b4a" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#ef9f27" }} />
                <span className="w-3 h-3 rounded-full" style={{ background: "#1d9e75" }} />
              </div>
              <div
                className="flex-1 text-center text-xs font-medium"
                style={{ color: "rgb(var(--text-tertiary))" }}
              >
                MailOS — Inbox
              </div>
              <div className="w-12" /> {/* Spacer to balance dots */}
            </div>

            {/* 3-Column Layout */}
            <div className="flex min-h-[320px] sm:min-h-[380px]">
              {/* Left Sidebar */}
              <div
                className="hidden sm:flex flex-col py-3 px-3 shrink-0"
                style={{
                  width: "160px",
                  borderRight: "0.5px solid rgba(var(--border-primary))",
                }}
              >
                {/* Sidebar nav items */}
                {[
                  { icon: Inbox, label: "Inbox", badge: 12, active: true },
                  { icon: Star, label: "Starred", badge: null, active: false },
                  { icon: Send, label: "Sent", badge: null, active: false },
                  { icon: FileText, label: "Drafts", badge: null, active: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium mb-0.5"
                    style={{
                      background: item.active ? "rgba(var(--surface-glass-hover))" : "transparent",
                      color: item.active
                        ? "rgb(var(--text-primary))"
                        : "rgb(var(--text-secondary))",
                    }}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{
                          background: "rgba(var(--accent-purple), 0.15)",
                          color: "rgb(var(--accent-purple))",
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                ))}

                {/* Divider */}
                <div
                  className="my-3"
                  style={{ borderTop: "0.5px solid rgba(var(--border-primary))" }}
                />

                {/* Labels */}
                <div
                  className="text-[10px] uppercase font-semibold tracking-wider px-2.5 mb-2"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                >
                  Labels
                </div>
                {[
                  { name: "Urgent", color: "#e24b4a" },
                  { name: "Personal", color: "#1d9e75" },
                  { name: "Work", color: "#378add" },
                ].map((label) => (
                  <div
                    key={label.name}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs"
                    style={{ color: "rgb(var(--text-secondary))" }}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: label.color }}
                    />
                    {label.name}
                  </div>
                ))}
              </div>

              {/* Center: Email List */}
              <div className="flex-1 min-w-0">
                {MOCK_EMAILS.map((email, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-4 py-3 transition-colors cursor-default"
                    style={{
                      borderBottom: "0.5px solid rgba(var(--border-secondary))",
                      background:
                        idx === 0
                          ? "rgba(var(--surface-glass-hover))"
                          : "transparent",
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                      style={{
                        background: `${email.initialsColor}20`,
                        color: email.initialsColor,
                      }}
                    >
                      {email.initials}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="text-xs truncate"
                          style={{
                            fontWeight: email.unread ? 600 : 400,
                            color: "rgb(var(--text-primary))",
                          }}
                        >
                          {email.sender}
                        </span>
                      </div>
                      <div
                        className="text-xs truncate"
                        style={{ color: "rgb(var(--text-secondary))" }}
                      >
                        {email.subject}
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-[10px]"
                        style={{ color: "rgb(var(--text-tertiary))" }}
                      >
                        {email.time}
                      </span>
                      {email.priority && (
                        <span
                          className="hp-priority"
                          style={{
                            background:
                              email.priority === "high"
                                ? "rgba(226, 75, 74, 0.15)"
                                : email.priority === "med"
                                  ? "rgba(239, 159, 39, 0.15)"
                                  : "rgba(var(--surface-glass-hover))",
                            color:
                              email.priority === "high"
                                ? "#e24b4a"
                                : email.priority === "med"
                                  ? "#ef9f27"
                                  : "rgb(var(--text-tertiary))",
                          }}
                        >
                          {email.priority}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right: Calendar Panel */}
              <div
                className="hidden lg:flex flex-col py-3 px-3 shrink-0"
                style={{
                  width: "220px",
                  borderLeft: "0.5px solid rgba(var(--border-primary))",
                }}
              >
                <div
                  className="text-[10px] uppercase font-semibold tracking-wider px-2 mb-3"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                >
                  Today
                </div>
                {MOCK_EVENTS.map((event, idx) => (
                  <div
                    key={idx}
                    className="mb-2.5 px-2 py-2 rounded-lg"
                    style={{
                      borderLeft: `2.5px solid ${event.color}`,
                      background: "rgba(var(--surface-glass))",
                    }}
                  >
                    <div
                      className="text-[10px] font-medium mb-0.5"
                      style={{ color: event.color }}
                    >
                      {event.time}
                    </div>
                    <div
                      className="text-xs font-medium"
                      style={{ color: "rgb(var(--text-primary))" }}
                    >
                      {event.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4. STATS BAR ═══════════════ */}
      <section ref={statsRef} className="hp-reveal">
        <div
          className="py-10 px-4 sm:px-6"
          style={{
            borderTop: "0.5px solid rgba(var(--border-primary))",
            borderBottom: "0.5px solid rgba(var(--border-primary))",
          }}
        >
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
            {STATS.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div
                  className="text-3xl sm:text-4xl font-bold mb-1"
                  style={{
                    color: "rgb(var(--text-primary))",
                    letterSpacing: "-1px",
                  }}
                >
                  {stat.value}
                </div>
                <div
                  className="text-xs sm:text-sm"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5. FEATURES GRID ═══════════════ */}
      <section ref={featuresRef} id="features" className="hp-reveal hp-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{
                letterSpacing: "-0.8px",
                color: "rgb(var(--text-primary))",
              }}
            >
              Everything you need, nothing you don&apos;t
            </h2>
            <p
              className="text-sm max-w-md mx-auto"
              style={{ color: "rgb(var(--text-secondary))" }}
            >
              Built for power users who live in their inbox. Every feature
              accessible from the keyboard.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 hp-stagger">
            {FEATURES.map((feature, idx) => (
              <div
                key={idx}
                className="hp-card hp-reveal rounded-xl p-5"
                style={{
                  border: "0.5px solid rgba(var(--border-primary))",
                  background: "rgb(var(--bg-secondary))",
                }}
              >
                {/* Icon Box */}
                <div
                  className="hp-icon-box mb-4"
                  style={{ background: feature.bgColor }}
                >
                  <feature.icon
                    className="w-[18px] h-[18px]"
                    style={{ color: feature.color }}
                  />
                </div>

                <h3
                  className="text-sm font-semibold mb-2"
                  style={{ color: "rgb(var(--text-primary))" }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-xs leading-relaxed mb-3"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  {feature.desc}
                </p>

                {/* Tag Pill */}
                <span
                  className="hp-tag"
                  style={{
                    background: feature.bgColor,
                    color: feature.color,
                  }}
                >
                  {feature.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5b. PRICING ═══════════════ */}
      <section ref={pricingRef} id="pricing" className="hp-reveal hp-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{
                letterSpacing: "-0.8px",
                color: "rgb(var(--text-primary))",
              }}
            >
              Simple, transparent pricing
            </h2>
            <p
              className="text-sm max-w-md mx-auto"
              style={{ color: "rgb(var(--text-secondary))" }}
            >
              Start free, upgrade when you&apos;re ready. No hidden fees, cancel
              anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start hp-stagger">
            {PRICING_PLANS.map((plan, idx) => (
              <div
                key={plan.name}
                className="hp-card hp-reveal rounded-xl flex flex-col relative"
                style={{
                  border: plan.popular
                    ? `1.5px solid ${plan.borderColor}`
                    : `0.5px solid ${plan.borderColor}`,
                  background: "rgb(var(--bg-secondary))",
                }}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{
                      background: "rgb(var(--accent-purple))",
                      color: "#fff",
                    }}
                  >
                    Most popular
                  </div>
                )}

                {/* Plan Header */}
                <div
                  className="p-6 pb-4"
                  style={{
                    borderBottom: "0.5px solid rgba(var(--border-primary))",
                  }}
                >
                  <div
                    className="text-xs font-semibold uppercase tracking-wider mb-3"
                    style={{ color: plan.color }}
                  >
                    {plan.name}
                  </div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span
                      className="text-4xl font-bold"
                      style={{
                        color: "rgb(var(--text-primary))",
                        letterSpacing: "-1.5px",
                      }}
                    >
                      {plan.price}
                    </span>
                    <span
                      className="text-sm"
                      style={{ color: "rgb(var(--text-tertiary))" }}
                    >
                      {plan.period}
                    </span>
                  </div>
                  <p
                    className="text-xs leading-relaxed"
                    style={{ color: "rgb(var(--text-secondary))" }}
                  >
                    {plan.desc}
                  </p>
                </div>

                {/* Features List */}
                <div className="p-6 pt-4 flex-1">
                  <ul className="space-y-2.5">
                    {plan.features.map((feature, fIdx) => (
                      <li
                        key={fIdx}
                        className="flex items-start gap-2.5 text-xs"
                      >
                        <Check
                          className="w-3.5 h-3.5 shrink-0 mt-0.5"
                          style={{ color: plan.color }}
                        />
                        <span
                          style={{ color: "rgb(var(--text-secondary))" }}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="px-6 pb-6">
                  <Link
                    href={isAuthenticated ? "/dashboard" : "/signup"}
                    className="block w-full text-center py-2.5 text-sm font-medium rounded-lg transition-all"
                    style={{
                      background: plan.popular
                        ? "rgb(var(--accent-purple))"
                        : "transparent",
                      color: plan.popular
                        ? "#fff"
                        : "rgb(var(--text-secondary))",
                      border: plan.popular
                        ? "none"
                        : "0.5px solid rgba(var(--border-primary))",
                    }}
                  >
                    {isAuthenticated ? "Go to Dashboard" : plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Fine print */}
          <p
            className="text-center text-xs mt-6"
            style={{ color: "rgb(var(--text-tertiary))" }}
          >
            All plans include Gmail integration · Google Calendar sync · End-to-end encryption
          </p>
        </div>
      </section>

      {/* ═══════════════ 6. HOW IT WORKS ═══════════════ */}
      <section ref={howRef} id="how-it-works" className="hp-reveal hp-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{
                letterSpacing: "-0.8px",
                color: "rgb(var(--text-primary))",
              }}
            >
              How it works
            </h2>
            <p
              className="text-sm max-w-md mx-auto"
              style={{ color: "rgb(var(--text-secondary))" }}
            >
              From zero to inbox zero in four steps.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left: Steps */}
            <div className="space-y-5">
              {HOW_IT_WORKS_STEPS.map((step, idx) => (
                <div
                  key={step.num}
                  className="flex gap-4 items-start p-4 rounded-xl transition-colors"
                  style={{
                    background:
                      idx === 0
                        ? "rgb(var(--bg-secondary))"
                        : "transparent",
                    border:
                      idx === 0
                        ? "0.5px solid rgba(var(--border-active))"
                        : "0.5px solid transparent",
                  }}
                >
                  <div
                    className="hp-step-num"
                    style={{
                      background:
                        idx === 0
                          ? "rgb(var(--accent-purple))"
                          : "rgba(var(--surface-glass-hover))",
                      color:
                        idx === 0
                          ? "#fff"
                          : "rgb(var(--text-tertiary))",
                    }}
                  >
                    {step.num}
                  </div>
                  <div>
                    <h3
                      className="text-sm font-semibold mb-1"
                      style={{
                        color:
                          idx === 0
                            ? "rgb(var(--text-primary))"
                            : "rgb(var(--text-secondary))",
                      }}
                    >
                      {step.title}
                    </h3>
                    <p
                      className="text-xs leading-relaxed"
                      style={{ color: "rgb(var(--text-tertiary))" }}
                    >
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Agent Demo Card */}
            <div
              className="rounded-xl overflow-hidden"
              style={{
                border: "0.5px solid rgba(var(--border-primary))",
                background: "rgb(var(--bg-secondary))",
              }}
            >
              {/* Agent Input */}
              <div className="p-4">
                <div
                  className="text-[10px] uppercase font-semibold tracking-wider mb-3"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                >
                  Corsair MCP Agent
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                  style={{
                    border: "0.5px solid rgba(var(--border-primary))",
                    background: "rgb(var(--bg-tertiary))",
                  }}
                >
                  <Terminal
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: "rgb(var(--accent-purple))" }}
                  />
                  <span
                    className="text-xs"
                    style={{ color: "rgb(var(--text-secondary))" }}
                  >
                    Schedule a 30min standup with Sarah tomorrow at 10am and email her the invite
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div
                className="flex items-center gap-3 px-4 py-2"
                style={{
                  borderTop: "0.5px solid rgba(var(--border-primary))",
                  borderBottom: "0.5px solid rgba(var(--border-primary))",
                  background: "rgba(var(--surface-glass))",
                }}
              >
                <CircleDot
                  className="w-3 h-3"
                  style={{ color: "rgb(var(--accent-green))" }}
                />
                <span
                  className="text-[10px] uppercase font-semibold tracking-wider"
                  style={{ color: "rgb(var(--accent-green))" }}
                >
                  Corsair MCP executing
                </span>
                <div
                  className="flex-1 h-px"
                  style={{ background: "rgba(var(--border-primary))" }}
                />
              </div>

              {/* Result Cards */}
              <div className="p-4 space-y-3">
                {/* Calendar Result */}
                <div
                  className="flex items-start gap-3 p-3 rounded-lg"
                  style={{
                    border: "0.5px solid rgba(var(--border-primary))",
                    background: "rgb(var(--bg-tertiary))",
                  }}
                >
                  <div
                    className="hp-icon-box"
                    style={{
                      background: "rgba(29, 158, 117, 0.12)",
                      width: "28px",
                      height: "28px",
                    }}
                  >
                    <CheckCircle2
                      className="w-3.5 h-3.5"
                      style={{ color: "#1d9e75" }}
                    />
                  </div>
                  <div>
                    <div
                      className="text-xs font-medium mb-0.5"
                      style={{ color: "rgb(var(--text-primary))" }}
                    >
                      Calendar invite sent
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: "rgb(var(--text-tertiary))" }}
                    >
                      &quot;Standup with Sarah&quot; · Tomorrow, 10:00 – 10:30 AM
                    </div>
                  </div>
                </div>

                {/* Email Result */}
                <div
                  className="flex items-start gap-3 p-3 rounded-lg"
                  style={{
                    border: "0.5px solid rgba(var(--border-primary))",
                    background: "rgb(var(--bg-tertiary))",
                  }}
                >
                  <div
                    className="hp-icon-box"
                    style={{
                      background: "rgba(55, 138, 221, 0.12)",
                      width: "28px",
                      height: "28px",
                    }}
                  >
                    <CheckCircle2
                      className="w-3.5 h-3.5"
                      style={{ color: "#378add" }}
                    />
                  </div>
                  <div>
                    <div
                      className="text-xs font-medium mb-0.5"
                      style={{ color: "rgb(var(--text-primary))" }}
                    >
                      Email sent to Sarah Chen
                    </div>
                    <div
                      className="text-[11px]"
                      style={{ color: "rgb(var(--text-tertiary))" }}
                    >
                      Subject: &quot;Standup invite for tomorrow&quot;
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 7. KEYBOARD SHORTCUTS ═══════════════ */}
      <section
        ref={shortcutsRef}
        id="shortcuts"
        className="hp-reveal hp-section"
      >
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{
                letterSpacing: "-0.8px",
                color: "rgb(var(--text-primary))",
              }}
            >
              Keyboard shortcuts for everything
            </h2>
            <p
              className="text-sm max-w-md mx-auto"
              style={{ color: "rgb(var(--text-secondary))" }}
            >
              Designed for speed. Every action is a keystroke away.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 hp-stagger">
            {SHORTCUTS.map((shortcut, idx) => (
              <div
                key={idx}
                className="hp-card hp-reveal flex flex-col items-center justify-center gap-3 py-6 px-4 rounded-xl text-center"
                style={{
                  border: "0.5px solid rgba(var(--border-primary))",
                  background: "rgb(var(--bg-secondary))",
                }}
              >
                <span className="hp-kbd">{shortcut.key}</span>
                <span
                  className="text-xs"
                  style={{ color: "rgb(var(--text-secondary))" }}
                >
                  {shortcut.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8. CTA SECTION ═══════════════ */}
      <section ref={ctaRef} className="hp-reveal hp-section">
        <div className="max-w-3xl mx-auto">
          <div
            className="rounded-2xl p-8 sm:p-12 text-center"
            style={{
              border: "0.5px solid rgba(var(--border-primary))",
              background: "rgb(var(--bg-secondary))",
            }}
          >
            <h2
              className="text-2xl sm:text-3xl font-bold mb-3"
              style={{
                letterSpacing: "-0.8px",
                color: "rgb(var(--text-primary))",
              }}
            >
              Ready to take back your inbox?
            </h2>
            <p
              className="text-sm mb-8 max-w-sm mx-auto"
              style={{ color: "rgb(var(--text-secondary))" }}
            >
              Join thousands of power users who handle email in half the time.
              Free to start, no credit card needed.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg hp-btn-primary"
                  style={{
                    background: "rgb(var(--accent-purple))",
                    color: "#fff",
                  }}
                >
                  <Zap className="w-4 h-4" />
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg hp-btn-primary"
                    style={{
                      background: "rgb(var(--accent-purple))",
                      color: "#fff",
                    }}
                  >
                    <Zap className="w-4 h-4" />
                    Start for free
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg hp-btn-ghost"
                    style={{
                      color: "rgb(var(--text-secondary))",
                      border: "0.5px solid rgba(var(--border-primary))",
                    }}
                  >
                    View dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 9. FOOTER ═══════════════ */}
      <footer
        className="py-8 px-4 sm:px-6"
        style={{
          borderTop: "0.5px solid rgba(var(--border-primary))",
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/home" className="flex items-center gap-2">
            <img
              src="/android-chrome-192x192.png"
              alt="MailOS Logo"
              className="w-6 h-6 rounded-md object-contain"
            />
            <span
              className="text-sm font-semibold"
              style={{ color: "rgb(var(--text-primary))" }}
            >
              MailOS
            </span>
          </Link>

          {/* Links */}
          <div className="flex items-center gap-5">
            {[
              { label: "Privacy", href: "/privacy", isExternal: false },
              { label: "Terms", href: "/terms", isExternal: false },
              { label: "GitHub", href: "https://github.com/Mr-Madhukar/MailOS-App", isExternal: true },
              { label: "Twitter/X", href: "https://x.com/Mr_Madhukar_", isExternal: true },
            ].map((link) =>
              link.isExternal ? (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href !== "#" ? "_blank" : undefined}
                  rel={link.href !== "#" ? "noopener noreferrer" : undefined}
                  className="text-xs transition-colors hover:underline"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-xs transition-colors hover:underline"
                  style={{ color: "rgb(var(--text-tertiary))" }}
                >
                  {link.label}
                </Link>
              )
            )}
          </div>

          {/* Credit */}
          <div
            className="text-xs text-center sm:text-right"
            style={{ color: "rgb(var(--text-tertiary))" }}
          >
            Built with Corsair · ChaiCode Hackathon 2026
          </div>
        </div>
      </footer>
    </div>
  );
}
