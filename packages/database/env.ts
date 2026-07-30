import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : typeof import.meta !== "undefined" && import.meta.url
      ? path.dirname(fileURLToPath(import.meta.url))
      : process.cwd();

dotenv.config({ path: path.resolve(currentDir, "../../.env") });

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).describe("Postgres URL — Neon pooled connection for the app"),
  DATABASE_URL_UNPOOLED: z.preprocess(
    emptyToUndefined,
    z.string().min(1).optional(),
  ).describe("Neon direct (non-pooler) URL — use for drizzle-kit migrate"),
});

const DEFAULT_DB_URL =
  "postgresql://neondb_owner:npg_od5ehfb4vPWN@ep-sparkling-shape-athchwlf-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require";

function createEnv(rawEnv: NodeJS.ProcessEnv) {
  const dbUrl = rawEnv.DATABASE_URL?.trim() || DEFAULT_DB_URL;
  const safeParseResult = envSchema.safeParse({
    ...rawEnv,
    DATABASE_URL: dbUrl,
  });
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
