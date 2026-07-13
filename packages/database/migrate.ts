import fs from "node:fs";
import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createPgClient, getMigrationDatabaseUrl } from "./pg";

import { fileURLToPath } from "node:url";

function resolveMigrationsFolder(): string {
  const currentDir =
    typeof __dirname !== "undefined"
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));

  const candidates = [
    path.join(process.cwd(), "packages/database/drizzle"),
    path.resolve(currentDir, "drizzle"),
    path.resolve(currentDir, "../drizzle"),
  ];

  for (const folder of candidates) {
    if (fs.existsSync(path.join(folder, "meta", "_journal.json"))) {
      return folder;
    }
  }

  throw new Error("Could not locate drizzle migrations folder");
}

/** Applies pending journal migrations from packages/database/drizzle. */
export async function runJournalMigrations(connectionString?: string) {
  const databaseUrl = connectionString ?? getMigrationDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run journal migrations");
  }

  const client = await createPgClient(databaseUrl);

  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: resolveMigrationsFolder() });
  } finally {
    await client.end();
  }
}
