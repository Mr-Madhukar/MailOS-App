import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

function getCurrentDir(): string {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }
  if (import.meta?.url) {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  return process.cwd();
}

const currentDir = getCurrentDir();

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

function createEnv(rawEnv: NodeJS.ProcessEnv) {
  const dbUrl = rawEnv.DATABASE_URL?.trim();
  const safeParseResult = envSchema.safeParse({
    ...rawEnv,
    DATABASE_URL: dbUrl,
  });
  if (!safeParseResult.success) throw new Error(safeParseResult.error.message);
  return safeParseResult.data;
}

export const env = createEnv(process.env);
