import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — MailOS",
  description: "Terms of Service for using MailOS.",
};

export default function TermsPage() {
  return (
    <main className="thread-privacy">
      <Link href="/" className="thread-privacy-back">
        ← Back to MailOS
      </Link>

      <h1 className="thread-privacy-title">Terms of Service</h1>
      <p className="thread-privacy-updated">Last updated: June 2026</p>

      <Section title="1. Acceptance of Terms">
        By accessing or using MailOS (&quot;the app&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use the app.
      </Section>

      <Section title="2. Description of Service">
        MailOS is a productivity application that aggregates Gmail and Google Calendar into a keyboard-first AI command center. We use API access via Google OAuth to provide features such as mail composition, calendar scheduling, search, smart replies, and email priority summary.
      </Section>

      <Section title="3. Google API Data & Permissions">
        <p>MailOS utilizes Google APIs (Gmail and Google Calendar) to sync your data locally inside the application runtime. By connecting your Google Account, you agree to grant us permissions to read and write events and messages.</p>
        <p>Your access is governed by the Google API Services User Data Policy, including the Limited Use requirements. You can revoke access at any time through your Google Security Settings.</p>
      </Section>

      <Section title="4. Acceptable Use">
        You agree to use MailOS only for lawful purposes. You are solely responsible for all content sent from the app. You must not attempt to abuse the Google API rate limits, bypass security boundaries, or use the AI Agent tool to distribute spam or malicious content.
      </Section>

      <Section title="5. AI Processing & Limitations">
        MailOS integrates third-party Large Language Models (LLMs) like OpenAI to generate daily summaries and action suggestions. While we design safety boundaries, AI-generated outputs might occasionally contain inaccuracies. You must review queued actions before approving them. We do not guarantee the completeness or accuracy of any AI suggestions.
      </Section>

      <Section title="6. Disclaimer of Warranties">
        MailOS is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied. We do not guarantee uninterrupted access or that the service will be entirely error-free.
      </Section>

      <Section title="7. Contact">
        <p>
          For any questions about these Terms of Service, please contact us at{" "}
          <a href="mailto:support@mailos-app.vercel.app">support@mailos-app.vercel.app</a>.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="thread-privacy-section">
      <h2>{title}</h2>
      <div className="thread-privacy-body">{children}</div>
    </section>
  );
}
