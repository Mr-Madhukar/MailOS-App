"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Command,
  Sun,
  Moon,
  ArrowLeft,
  Shield,
  Eye,
  Lock,
  Database,
  Mail,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export default function PrivacyPage() {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("introduction");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sections = [
    { id: "introduction", label: "Introduction" },
    { id: "information-we-collect", label: "Information We Collect" },
    { id: "how-we-use-information", label: "How We Use Information" },
    { id: "google-oauth-data", label: "Google User Data & Scopes" },
    { id: "data-storage-security", label: "Data Storage & Security" },
    { id: "limited-use-policy", label: "Google Limited Use Policy" },
    { id: "your-rights", label: "Your Rights & Choices" },
    { id: "contact-us", label: "Contact Us" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        background: "rgb(var(--bg-primary))",
        color: "rgb(var(--text-primary))",
      }}
    >
      {/* Navbar */}
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
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgb(var(--accent-purple))" }}
              >
                <Command className="w-4 h-4 text-white" />
              </div>
              <span className="text-base font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
                MailOS
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={{
                  color: "rgb(var(--text-secondary))",
                  border: "0.5px solid rgba(var(--border-primary))",
                  background: "rgba(var(--surface-glass))",
                }}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Home
              </Link>

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
            </div>
          </div>
        </div>
      </nav>

      {/* Header Banner */}
      <header
        className="relative py-16 px-4 overflow-hidden"
        style={{
          borderBottom: "0.5px solid rgba(var(--border-primary))",
          background: "linear-gradient(180deg, rgba(var(--accent-purple), 0.03) 0%, transparent 100%)",
        }}
      >
        {/* Visual Glow */}
        <div
          className="absolute -top-24 left-1/2 -translate-x-1/2 w-[400px] h-[200px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: "rgba(var(--accent-purple), 0.15)" }}
        />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
               style={{
                 background: "rgba(var(--accent-purple), 0.1)",
                 color: "rgb(var(--accent-purple))",
                 border: "0.5px solid rgba(var(--accent-purple), 0.2)"
               }}>
            <Shield className="w-3.5 h-3.5" />
            Privacy & Trust
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight"
            style={{ color: "rgb(var(--text-primary))" }}
          >
            Privacy Policy
          </h1>
          <p
            className="text-sm max-w-lg mx-auto"
            style={{ color: "rgb(var(--text-secondary))" }}
          >
            Last updated: June 18, 2026. This Privacy Policy describes how MailOS collects, uses, and protects your information when you connect your accounts.
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          
          {/* Sticky Sidebar Navigation */}
          <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 hidden lg:block">
            <div
              className="p-4 rounded-xl"
              style={{
                border: "0.5px solid rgba(var(--border-primary))",
                background: "rgb(var(--bg-secondary))",
              }}
            >
              <div className="text-xs uppercase font-bold tracking-wider mb-4 px-2" style={{ color: "rgb(var(--text-tertiary))" }}>
                Table of Contents
              </div>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="block px-2.5 py-2 text-xs rounded-lg transition-colors font-medium"
                    style={{
                      color: activeSection === section.id ? "rgb(var(--text-primary))" : "rgb(var(--text-secondary))",
                      background: activeSection === section.id ? "rgba(var(--surface-glass-hover))" : "transparent",
                    }}
                  >
                    {section.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Policy Text Content */}
          <div className="flex-1 min-w-0 space-y-10">
            
            {/* Quick Takeaways Box */}
            <section
              className="p-6 rounded-xl"
              style={{
                border: "0.5px solid rgba(var(--accent-purple), 0.2)",
                background: "linear-gradient(135deg, rgba(var(--accent-purple), 0.02) 0%, rgba(var(--surface-glass)) 100%)",
              }}
            >
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "rgb(var(--text-primary))" }}>
                <Eye className="w-4 h-4 text-purple-400" />
                Quick Summary for Users
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span style={{ color: "rgb(var(--text-secondary))" }}>
                    <strong>Direct Connection:</strong> We connect your browser directly to Google APIs using secure OAuth 2.0 protocols.
                  </span>
                </li>
                  <li className="flex items-start gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span style={{ color: "rgb(var(--text-secondary))" }}>
                    <strong>No Data Selling:</strong> We never sell, rent, or distribute your email or calendar contents to advertisers or third parties.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span style={{ color: "rgb(var(--text-secondary))" }}>
                    <strong>Secure Storage:</strong> Credentials and user data are encrypted end-to-end and stored securely.
                  </span>
                </li>
              </ul>
            </section>

            {/* Section 1: Introduction */}
            <section id="introduction" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                1. Introduction
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  Welcome to MailOS. We value your privacy and are committed to protecting your personal data. MailOS is a keyboard-first, AI-driven mail client and scheduling app designed to unify your workflow.
                </p>
                <p>
                  This Privacy Policy explains how we collect, use, store, and share information when you access or use our services via `https://mailos-app.vercel.app`. By using our application, you agree to the terms described in this policy.
                </p>
              </div>
            </section>

            {/* Section 2: Information We Collect */}
            <section id="information-we-collect" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                2. Information We Collect
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  To provide you with our keyboard-first email and calendar dashboard, we collect the following types of information:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-2">
                  <li>
                    <strong>Account Credentials:</strong> Basic account information such as your name, email address, and profile settings when you register.
                  </li>
                  <li>
                    <strong>Connected Service Tokens:</strong> OAuth 2.0 access and refresh tokens returned by Google. These tokens allow us to display your emails and calendar events.
                  </li>
                  <li>
                    <strong>Usage Data:</strong> Technical logs, shortcut usage patterns, and device diagnostics to optimize command-palette speed and responsiveness.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 3: How We Use Information */}
            <section id="how-we-use-information" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                3. How We Use Information
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  We process your information to deliver and optimize MailOS, specifically:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-2">
                  <li>To display, organize, search, and respond to your emails.</li>
                  <li>To sync, create, edit, and notify you about calendar events.</li>
                  <li>To process user commands executed via the keyboard command palette.</li>
                  <li>To prevent unauthorized access, secure your data, and maintain system stability.</li>
                </ul>
              </div>
            </section>

            {/* Section 4: Google User Data & Scopes */}
            <section id="google-oauth-data" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                4. Google User Data & Scopes
              </h2>
              <div className="text-xs leading-relaxed space-y-4" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  MailOS connects to your Google account using secure OAuth 2.0 authentication. We request permission to access the following scopes:
                </p>

                <div className="space-y-3">
                  <div className="p-3 rounded-lg border" style={{ borderColor: "rgba(var(--border-primary))", background: "rgb(var(--bg-secondary))" }}>
                    <div className="font-semibold text-xs mb-1" style={{ color: "rgb(var(--text-primary))" }}>
                      Gmail API Scope (<code>https://www.googleapis.com/auth/gmail.modify</code>)
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Allows MailOS to read, send, draft, label, search, and organize your emails. This is required for core inbox features.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border" style={{ borderColor: "rgba(var(--border-primary))", background: "rgb(var(--bg-secondary))" }}>
                    <div className="font-semibold text-xs mb-1" style={{ color: "rgb(var(--text-primary))" }}>
                      Google Calendar Scope (<code>https://www.googleapis.com/auth/calendar</code>)
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Allows MailOS to view, edit, share, and delete calendar events. This is required to show your schedule and schedule meetings.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5: Data Storage & Security */}
            <section id="data-storage-security" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                5. Data Storage & Security
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  Your security is our absolute priority. We implement professional security measures to shield your data:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-2">
                  <li>
                    <strong>Access Tokens:</strong> Google Access and Refresh tokens are encrypted using AES-256 encryption before being stored in our Neon Postgres database.
                  </li>
                  <li>
                    <strong>Email Bodies:</strong> Message bodies and calendar details are fetched dynamically using secure HTTPS requests directly to Google servers. They are cached temporarily in your browser state and are not kept permanently on our databases.
                  </li>
                  <li>
                    <strong>SSL/TLS:</strong> All communications between your client, the MailOS server, and Google APIs are encrypted with industry-standard TLS protocols.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 6: Google Limited Use Policy */}
            <section id="limited-use-policy" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                6. Google Limited Use Policy Compliance
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  MailOS&apos;s use and transfer of information received from Google APIs to any other app will adhere to the{" "}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-purple-400"
                  >
                    Google API Services User Data Policy
                  </a>
                  , including the Limited Use requirements:
                </p>
                <ol className="list-decimal list-inside pl-2 space-y-2">
                  <li>
                    We only use access to read, write, modify, or control Gmail message bodies, attachments, metadata, and calendar events to provide the email client UI and tools.
                  </li>
                  <li>
                    We do not transfer or share your Google user data with third parties unless necessary to provide or improve features, comply with laws, or as part of a merger/acquisition.
                  </li>
                  <li>
                    We do not use your Google user data for serving advertisements.
                  </li>
                  <li>
                    We do not allow humans to read your Google user data unless we have your explicit agreement, it is necessary for security/compliance purposes, or to debug application errors where data is aggregated.
                  </li>
                </ol>
              </div>
            </section>

            {/* Section 7: Your Rights */}
            <section id="your-rights" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                7. Your Rights & Choices
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  You are in full control of your data and connections:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-2">
                  <li>
                    <strong>Revoking Access:</strong> You can disconnect your Gmail or Calendar from the settings modal in MailOS at any time, or directly revoke access from your{" "}
                    <a
                      href="https://myaccount.google.com/permissions"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-purple-400"
                    >
                      Google Account Security Page
                    </a>.
                  </li>
                  <li>
                    <strong>Account Deletion:</strong> You can request complete deletion of your account and all associated tokens by contacting our support team.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 8: Contact Us */}
            <section id="contact-us" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                8. Contact Us
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us at:
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Mail className="w-4 h-4 text-purple-400" />
                  <a href="mailto:support@mailos-app.vercel.app" className="underline font-medium" style={{ color: "rgb(var(--text-primary))" }}>
                    support@mailos-app.vercel.app
                  </a>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="py-8 px-4 sm:px-6 mt-16"
        style={{
          borderTop: "0.5px solid rgba(var(--border-primary))",
          background: "rgb(var(--bg-secondary))",
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "rgb(var(--accent-purple))" }}
            >
              <Command className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
              MailOS
            </span>
          </Link>

          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-xs font-medium underline" style={{ color: "rgb(var(--text-primary))" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs transition-colors hover:underline" style={{ color: "rgb(var(--text-secondary))" }}>
              Terms of Service
            </Link>
          </div>

          <div className="text-xs" style={{ color: "rgb(var(--text-tertiary))" }}>
            © {new Date().getFullYear()} MailOS. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
