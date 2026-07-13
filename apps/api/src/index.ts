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
  let expressHandler: http.RequestListener | null = null;
  let bootstrapPromise: Promise<void> | null = null;

  const server = http.createServer(async (req, res) => {
    const path = req.url?.split("?")[0] ?? "/";

    if (path === "/health" || path === "/") {
      writeJson(res, 200, {
        healthy: true,
        ready: Boolean(expressHandler),
        message: expressHandler ? "MailOS API is healthy" : "MailOS API is starting",
      });
      return;
    }

    if (!expressHandler) {
      logger.info(`Request to ${path} received before Express app was loaded. Waiting for startup...`);
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (expressHandler) break;
      }
    }

    if (!expressHandler) {
      writeJson(res, 503, {
        error: "MailOS API is starting",
        hint: "Wait a few seconds, or check Postgres is running (pnpm db:up) and DATABASE_URL in .env",
      });
      return;
    }

    expressHandler(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, () => resolve());
  });

  logger.info(`http server is running on 0.0.0.0:${PORT}`);

  bootstrapPromise = (async () => {
    try {
      logger.info("Starting MailOS API bootstrap...");
      await runApiBootstrap({ serverless: false });

      const { app } = await import("./server");
      expressHandler = app;
      logger.info("Express application loaded successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Failed to load Express application during bootstrap", { err, message });
      process.exit(1);
    }
  })();

  bootstrapPromise.catch((err) => {
    logger.error("Bootstrap process failed", { err });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error("Fatal bootstrap error", err);
  process.exit(1);
});
