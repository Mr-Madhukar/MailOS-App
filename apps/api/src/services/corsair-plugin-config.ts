/**
 * Corsair plugin configuration — permissions, API hooks, webhookHooks per docs.
 */
import { logger } from "@repo/logger";
import type { GmailPluginOptions } from "@corsair-dev/gmail";
import type { GoogleCalendarPluginOptions } from "@corsair-dev/googlecalendar";

import { incrementCounter } from "../metrics";
import { buildGmailWebhookHooks, buildGoogleCalendarWebhookHooks } from "./corsair-webhook-sync";

export function buildGmailApiHooks() {
  return {
    messages: {
      send: {
        after: () => {
          incrementCounter("corsair.hooks.gmail.messages.send");
        },
      },
    },
    threads: {
      list: {
        after: () => {
          incrementCounter("corsair.hooks.gmail.threads.list");
        },
      },
    },
    drafts: {
      send: {
        after: () => {
          incrementCounter("corsair.hooks.gmail.drafts.send");
        },
      },
    },
  } satisfies GmailPluginOptions["hooks"];
}

export function buildGoogleCalendarApiHooks() {
  return {
    events: {
      create: {
        after: () => {
          incrementCounter("corsair.hooks.googlecalendar.events.create");
        },
      },
      delete: {
        before: (ctx, args) => {
          logger.info("corsair.calendar.events.delete requested", { eventId: args.id });
          return { ctx, args };
        },
      },
    },
  } satisfies GoogleCalendarPluginOptions["hooks"];
}

export function buildGmailPluginOptions() {
  return {
    webhookHooks: buildGmailWebhookHooks(),
    hooks: buildGmailApiHooks(),
    permissions: {
      mode: "cautious" as const,
      overrides: {
        "threads.delete": "require_approval" as const,
        "messages.delete": "require_approval" as const,
      },
    },
  };
}

export function buildGoogleCalendarPluginOptions() {
  return {
    webhookHooks: buildGoogleCalendarWebhookHooks(),
    hooks: buildGoogleCalendarApiHooks(),
    permissions: {
      mode: "cautious" as const,
      overrides: {
        "events.delete": "require_approval" as const,
      },
    },
  };
}
