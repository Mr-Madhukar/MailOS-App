"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Command,
  Sun,
  Moon,
  ArrowLeft,
  Scale,
  ShieldAlert,
  AlertCircle,
  Cpu,
  Mail,
  FileText,
  FileCheck,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export default function TermsPage() {
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("acceptance");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sections = [
    { id: "acceptance", label: "1. Acceptance of Terms" },
    { id: "description-of-service", label: "2. Description of Service" },
    { id: "user-accounts", label: "3. User Accounts & Security" },
    { id: "acceptable-use", label: "4. Acceptable Use Policy" },
    { id: "pricing-billing", label: "5. Pricing & Payments" },
    { id: "disclaimers", label: "6. Disclaimers of Warranties" },
    { id: "limitation-of-liability", label: "7. Limitation of Liability" },
    { id: "changes-to-terms", label: "8. Changes to Terms" },
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
            <Scale className="w-3.5 h-3.5" />
            Terms of Service
          </div>
          <h1
            className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight"
            style={{ color: "rgb(var(--text-primary))" }}
          >
            Terms of Service
          </h1>
          <p
            className="text-sm max-w-lg mx-auto"
            style={{ color: "rgb(var(--text-secondary))" }}
          >
            Last updated: June 18, 2026. Please read these Terms of Service carefully before utilizing the MailOS application.
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
                Terms sections
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
            
            {/* Quick Summary Box */}
            <section
              className="p-6 rounded-xl"
              style={{
                border: "0.5px solid rgba(var(--accent-purple), 0.2)",
                background: "linear-gradient(135deg, rgba(var(--accent-purple), 0.02) 0%, rgba(var(--surface-glass)) 100%)",
              }}
            >
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "rgb(var(--text-primary))" }}>
                <FileCheck className="w-4 h-4 text-purple-400" />
                Key Terms Overview
              </h2>
              <ul className="space-y-3">
                <li className="flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span style={{ color: "rgb(var(--text-secondary))" }}>
                    <strong>Integration limits:</strong> MailOS relies directly on Google APIs to sync and send data. API limits imposed by Google apply to your MailOS usage.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span style={{ color: "rgb(var(--text-secondary))" }}>
                    <strong>Account Responsibility:</strong> You are responsible for protecting your credentials and keeping connected OAuth tokens secure.
                  </span>
                </li>
                <li className="flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span style={{ color: "rgb(var(--text-secondary))" }}>
                    <strong>Service Guarantee:</strong> The app is provided &quot;as is&quot;. We strive for 100% command-palette responsiveness, but offer no warranties on third-party integrations.
                  </span>
                </li>
              </ul>
            </section>

            {/* Section 1: Acceptance */}
            <section id="acceptance" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                1. Acceptance of Terms
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  By accessing or using the MailOS application located at `https://mailos-app.vercel.app` (the &quot;Service&quot;), you agree to comply with and be bound by these Terms of Service (the &quot;Terms&quot;).
                </p>
                <p>
                  If you do not agree with any part of these Terms, you may not access or use the Service.
                </p>
              </div>
            </section>

            {/* Section 2: Description of Service */}
            <section id="description-of-service" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                2. Description of Service
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  MailOS is a keyboard-first productivity workspace that provides a unified, AI-command-driven inbox and calendar client. The Service aggregates your Google workspace APIs (Gmail and Google Calendar) into a local keyboard-first command interface.
                </p>
                <p>
                  To use the integration, you must log in with Google and grant the requested OAuth permissions. The Service requires these API connections to operate.
                </p>
              </div>
            </section>

            {/* Section 3: User Accounts & Security */}
            <section id="user-accounts" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                3. User Accounts & Security
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  To access some features of the Service, you must create a MailOS account. You agree to:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-2">
                  <li>Provide accurate, current, and complete information during registration.</li>
                  <li>Maintain the confidentiality of your password and credentials.</li>
                  <li>Promptly notify us of any security breach or unauthorized access to your account.</li>
                </ul>
              </div>
            </section>

            {/* Section 4: Acceptable Use Policy */}
            <section id="acceptable-use" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                4. Acceptable Use Policy
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  You agree that you will not use the Service to:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-2">
                  <li>Engage in spamming, phishing, or sending unsolicited bulk communications.</li>
                  <li>Transmit malware, viruses, or any other destructive software codes.</li>
                  <li>Attempt to bypass API limits, reverse engineer the platform, or execute denial of service attacks.</li>
                  <li>Interfere with or disrupt the servers, networks, or connected database instances supporting the Service.</li>
                </ul>
              </div>
            </section>

            {/* Section 5: Pricing & Payments */}
            <section id="pricing-billing" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                5. Pricing & Payments
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  MailOS offers free and premium tier subscriptions (Pro and Team tiers).
                </p>
                <p>
                  Premium plans are billed on a recurring monthly basis. All charges are non-refundable unless specified otherwise. You can cancel your subscription at any time, which will stop future recurring billing.
                </p>
              </div>
            </section>

            {/* Section 6: Disclaimers */}
            <section id="disclaimers" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                6. Disclaimers of Warranties
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. MAILOS DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE, MERCHANTABILITY, AND NON-INFRINGEMENT.
                </p>
                <p>
                  We make no warranty that (i) the Service will meet your requirements, (ii) the Service will be uninterrupted, timely, secure, or error-free, or (iii) any errors in the software will be corrected.
                </p>
              </div>
            </section>

            {/* Section 7: Limitation of Liability */}
            <section id="limitation-of-liability" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                7. Limitation of Liability
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, MAILOS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES RESULTING FROM THE USE OF OR INABILITY TO USE THE SERVICE.
                </p>
              </div>
            </section>

            {/* Section 8: Changes to Terms */}
            <section id="changes-to-terms" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text-primary))" }}>
                8. Changes to Terms
              </h2>
              <div className="text-xs leading-relaxed space-y-3" style={{ color: "rgb(var(--text-secondary))" }}>
                <p>
                  We reserve the right, at our sole discretion, to modify or replace these Terms at any time. If a revision is material, we will provide notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
                </p>
                <p>
                  By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
                </p>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t" style={{ borderColor: "rgba(var(--border-secondary))" }}>
                  <Mail className="w-4 h-4 text-purple-400" />
                  <span style={{ color: "rgb(var(--text-secondary))" }}>
                    Questions? Email us at{" "}
                    <a href="mailto:support@mailos-app.vercel.app" className="underline font-medium" style={{ color: "rgb(var(--text-primary))" }}>
                      support@mailos-app.vercel.app
                    </a>
                  </span>
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
            <Link href="/privacy" className="text-xs transition-colors hover:underline" style={{ color: "rgb(var(--text-secondary))" }}>
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs font-medium underline" style={{ color: "rgb(var(--text-primary))" }}>
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
