"use client";

import { useState } from "react";
import Link from "next/link";
import { ThreadAuthCard } from "./thread-auth-card";
import { ThreadLogoMark, ThreadWordmark } from "./thread-logo";
import "./mailos-auth.css";

type AuthMode = "sign-in" | "sign-up";

const AUTH_NAV = [
  { label: "How it works", href: "/#features" },
  { label: "Compare", href: "/#compare" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
];

type MailosAuthScreenProps = {
  mode?: AuthMode;
  errorMessage?: string;
  nextPath?: string;
  pendingTwoFactorEmail?: string;
  onCloseAction?: () => void;
};

export function MailosAuthScreen({
  mode: initialMode = "sign-in",
  errorMessage,
  nextPath,
  pendingTwoFactorEmail,
  onCloseAction,
}: MailosAuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const brand = onCloseAction ? (
    <button type="button" className="mailos-auth-brand" onClick={onCloseAction}>
      <ThreadLogoMark size={24} />
      <ThreadWordmark size="sm" />
    </button>
  ) : (
    <Link href="/" className="mailos-auth-brand">
      <ThreadLogoMark size={24} />
      <ThreadWordmark size="sm" />
    </Link>
  );

  return (
    <div className="thread-page mailos-auth-screen" suppressHydrationWarning>
      {/* Ambient glow */}
      <div className="mailos-auth-glow" aria-hidden="true" />

      <header className="mailos-auth-nav">
        {brand}
        <nav className="mailos-auth-nav-links" aria-label="Site">
          {AUTH_NAV.map((item) => (
            <a key={item.label} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="mailos-auth-nav-spacer" />
      </header>

      <main className="mailos-auth-main">
        <ThreadAuthCard
          mode={mode}
          onModeChange={setMode}
          errorMessage={errorMessage}
          nextPath={nextPath}
          pendingTwoFactorEmail={pendingTwoFactorEmail}
        />
      </main>
    </div>
  );
}
