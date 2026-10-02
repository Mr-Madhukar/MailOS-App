/**
 * Shared API bootstrap — used by Railway (index.ts) and Vercel (api/index.ts).
 *
 * Static service imports keep the Vercel serverless bundle self-contained
 * (dynamic import() would resolve missing ./services/* at runtime).
 */
import { logger } from "@repo/logger";
import { registerCalendarService } from "@repo/services/calendar";
import { registerContactsService } from "@repo/services/contacts";
import { isEmailConfigured } from "@repo/services/env";
import { registerInboxService } from "@repo/services/inbox";
import { registerQueueService } from "@repo/services/queue";
import { registerSettingsService } from "@repo/services/settings";

import { bootstrapCorsair } from "./corsair-bootstrap";
import { runMigrations } from "./migrate";
import { CorsairCalendarService } from "./services/calendar";
import { DbContactsService } from "./services/contacts";
import { CorsairInboxService } from "./services/inbox";
import { ThreadQueueService } from "./services/queue";
import { DbSettingsService } from "./services/settings";

export type ApiBootstrapOptions = {
  /** Skip long-running cron / Redis when running as a serverless function. */
  serverless?: boolean;
};

async function bootstrapDatabaseMigrations(serverless: boolean): Promise<void> {
  if (serverless) {
    logger.info("Serverless environment: skipping startup database migrations");
    return;
  }
  try {
    await runMigrations();
    logger.info("Database schema patches applied");
  } catch (err) {
    logger.error("Database migration failed", { err });
  }
}

async function bootstrapInboxService(): Promise<void> {
  try {
    const inbox = new CorsairInboxService();
    if (process.env.THREAD_E2E_MOCK_GMAIL === "true") {
      const { createE2eMockInboxService } = await import("./services/inbox-e2e-mock");
      registerInboxService(createE2eMockInboxService(inbox));
      logger.info("Inbox: E2E mock Gmail enabled");
    } else {
      registerInboxService(inbox);
    }
  } catch (err) {
    logger.warn("Inbox service registration failed", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function registerSafe(name: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    logger.warn(`${name} service registration failed`, {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

function bootstrapCoreServices(): void {
  registerSafe("Calendar", () => registerCalendarService(new CorsairCalendarService()));
  registerSafe("Queue", () => registerQueueService(new ThreadQueueService()));
  registerSafe("Contacts", () => registerContactsService(new DbContactsService()));
  registerSafe("Settings", () => registerSettingsService(new DbSettingsService()));
}

async function bootstrapBackgroundJobs(serverless: boolean): Promise<void> {
  if (serverless) {
    return;
  }

  try {
    const { startIntegrationRenewalJob } = await import("./jobs/integration-renewal");
    startIntegrationRenewalJob();
  } catch (err) {
    logger.warn("Integration renewal job skipped", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const { startSyncEventRedisBridge } = await import("./services/sync-events");
    await startSyncEventRedisBridge();
  } catch (err) {
    logger.warn("Sync event Redis bridge skipped", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function runApiBootstrap(opts: ApiBootstrapOptions = {}): Promise<void> {
  const { serverless = false } = opts;

  await bootstrapDatabaseMigrations(serverless);
  await bootstrapInboxService();
  bootstrapCoreServices();

  try {
    await bootstrapCorsair();
  } catch (err) {
    logger.warn("Corsair bootstrap skipped", {
      message: err instanceof Error ? err.message : String(err),
    });
  }

  await bootstrapBackgroundJobs(serverless);

  logger.info(
    isEmailConfigured()
      ? "Email: provider configured"
      : "Email: not configured (set BREVO_API_KEY + EMAIL_FROM)",
  );
}

export function validateApiEnv(): string[] {
  return ["DATABASE_URL", "JWT_SECRET", "CORSAIR_KEK", "BASE_URL", "CLIENT_URL"].filter(
    (key) => !process.env[key]?.trim(),
  );
}
