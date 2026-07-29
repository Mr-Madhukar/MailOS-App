import pg from "pg";

import { env } from "./env";

/** Neon and other hosted Postgres URLs need SSL. */
export function isNeonDatabase(connectionString: string) {
  return connectionString.includes("neon.tech");
}

export function pgConnectionConfig(connectionString: string): pg.ClientConfig {
  const cleanUrl = connectionString.replace(/[?&]channel_binding=[^&]*/gi, "");
  const config: pg.ClientConfig = { connectionString: cleanUrl };

  if (
    isNeonDatabase(cleanUrl) ||
    /sslmode=(require|verify-full|verify-ca)/i.test(cleanUrl)
  ) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

/** Prefer Neon direct (non-pooler) URL for drizzle-kit / journal migrations. */
export function getMigrationDatabaseUrl() {
  return env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL;
}

export function createPgPool(connectionString = env.DATABASE_URL) {
  const config = pgConnectionConfig(connectionString);
  return new pg.Pool({
    ...config,
    max: isNeonDatabase(connectionString) ? 10 : 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 30_000,
    keepAlive: true,
  });
}

export async function createPgClient(connectionString?: string) {
  const url = connectionString ?? env.DATABASE_URL;
  const client = new pg.Client(pgConnectionConfig(url));
  await client.connect();
  return client;
}
