import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

function resolveCurrentDir(): string {
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }
  if (import.meta?.url) {
    return path.dirname(fileURLToPath(import.meta.url));
  }
  return process.cwd();
}

const currentDir = resolveCurrentDir();

dotenv.config({ path: path.resolve(currentDir, "../../../.env") });

// OpenTelemetry MUST be imported first — before any instrumented modules.
import { initTracing } from "./tracing";
initTracing();

import http from "node:http";
import { app } from "./server";
import { runApiBootstrap } from "./api-bootstrap";

const PORT = Number(process.env.PORT ?? 8000);

const server = http.createServer(app);

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[MailOS API] Server listening cleanly on 0.0.0.0:${PORT}`);
  runApiBootstrap({ serverless: false })
    .then(() => console.log("[MailOS API] Bootstrap completed successfully!"))
    .catch((err) => console.error("[MailOS API] Bootstrap error (continuing):", err));
});
