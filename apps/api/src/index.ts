// OpenTelemetry MUST be imported first — before any instrumented modules.
import { initTracing } from "./tracing";
initTracing();

import http from "node:http";

import { runApiBootstrap } from "./api-bootstrap";

const PORT = Number(process.env.PORT ?? 8000);

function writeJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function bootstrap() {
  const { logger } = await import("@repo/logger");
  logger.info("Starting MailOS API bootstrap...");

  await runApiBootstrap({ serverless: false });

  let expressHandler: http.RequestListener | null = null;
  try {
    const { app } = await import("./server");
    expressHandler = app;
    logger.info("Express application loaded successfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Failed to load Express application", { err, message });
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const path = req.url?.split("?")[0] ?? "/";

    if (path === "/health" || path === "/") {
      writeJson(res, 200, {
        healthy: true,
        ready: true,
        message: "MailOS API is healthy",
      });
      return;
    }

    expressHandler!(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "0.0.0.0", () => resolve());
  });

  logger.info(`http server is running on 0.0.0.0:${PORT}`);
}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error", err);
  process.exit(1);
});
