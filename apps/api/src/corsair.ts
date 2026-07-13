import { Pool } from "pg";
import { createCorsair } from "corsair";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { createPgPool } from "@repo/database/pg";

import { env } from "./env";
import {
  buildGmailPluginOptions,
  buildGoogleCalendarPluginOptions,
} from "./services/corsair-plugin-config";

let pool: Pool | null = null;

function initCorsairInstance() {
  const kek = process.env.CORSAIR_KEK!.trim();
  return createCorsair({
    plugins: [
      gmail(buildGmailPluginOptions()),
      googlecalendar(buildGoogleCalendarPluginOptions()),
    ],
    database: getCorsairPool(),
    kek,
    multiTenancy: true,
    hub: {
      projectApiKey: process.env.CORSAIR_DEV_KEY?.trim() || "",
      signingSecret: process.env.CORSAIR_WEBHOOK_SECRET?.trim() || "",
    },
    errorHandlers: {
      RATE_LIMIT_ERROR: {
        match: (error: unknown) => {
          const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
          const status =
            (error as { status?: number; response?: { status?: number } }).status ??
            (error as { response?: { status?: number } }).response?.status;
          return status === 429 || msg.includes("rate") || msg.includes("quota");
        },
        handler: async () => ({
          maxRetries: 4,
          retryStrategy: "exponential_backoff_jitter" as const,
        }),
      },
      DEFAULT: {
        match: () => true,
        handler: async (error: unknown) => {
          const status =
            (error as { status?: number; response?: { status?: number } }).status ??
            (error as { response?: { status?: number } }).response?.status;
          if (status !== undefined && status >= 500) {
            return { maxRetries: 2, retryStrategy: "exponential_backoff_jitter" as const };
          }
          return { maxRetries: 0 };
        },
      },
    },
    permissions: {
      timeout: "30m",
      onTimeout: "deny",
      mode: "asynchronous",
    },
    manual: {
      baseUrl: `${env.CLIENT_URL}/connect`,
      redirectUri:
        process.env.CORSAIR_GMAIL_REDIRECT_URI?.trim() ??
        `${env.CLIENT_URL}/api-connect/gmail/callback`,
      approvalBaseUrl: `${env.CLIENT_URL}/corsair/approve`,
      onApprovalRequired: ({ approvalUrl }: { approvalUrl: string }) =>
        `Action requires approval. Visit ${approvalUrl} to approve or deny, then retry.`,
    },
  });
}

let corsairInstance: ReturnType<typeof initCorsairInstance> | null = null;

export function isCorsairConfigured() {
  return Boolean(process.env.CORSAIR_KEK?.trim() && process.env.DATABASE_URL?.trim());
}

export function isCorsairDevKeyConfigured() {
  return Boolean(process.env.CORSAIR_DEV_KEY?.trim());
}

/** API key for headless MCP clients (falls back to CORSAIR_DEV_KEY). */
export function getThreadMcpApiKey() {
  return process.env.THREAD_MCP_API_KEY?.trim() || process.env.CORSAIR_DEV_KEY?.trim() || null;
}

export function getCorsairPool() {
  if (!pool) {
    pool = createPgPool();
  }
  return pool;
}

export function getCorsair(): ReturnType<typeof initCorsairInstance> {
  if (!isCorsairConfigured()) {
    throw new Error("Corsair is not configured. Set CORSAIR_KEK in .env");
  }

  if (!corsairInstance) {
    corsairInstance = initCorsairInstance();
  }

  return corsairInstance!;
}

export function getCorsairGmailRedirectUri() {
  return (
    process.env.CORSAIR_GMAIL_REDIRECT_URI?.trim() ??
    `${env.CLIENT_URL}/api-connect/gmail/callback`
  );
}

export function getCorsairCalendarRedirectUri() {
  return (
    process.env.CORSAIR_CALENDAR_REDIRECT_URI?.trim() ??
    `${env.CLIENT_URL}/api-connect/calendar/callback`
  );
}

