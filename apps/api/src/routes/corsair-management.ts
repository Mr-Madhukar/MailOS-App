import { Router } from "express";
import { toExpressHandler } from "corsair";

import { getCorsair, isCorsairConfigured } from "../corsair";
import { webhooksRouter } from "./webhooks";

export const corsairManagementRouter = Router();

corsairManagementRouter.use((req, res, next) => {
  if (!isCorsairConfigured()) {
    return res.status(503).json({ error: "Corsair is not configured" });
  }

  // Support delivering Corsair webhooks to the management endpoint URL as a fallback.
  if (req.method === "POST") {
    const isWebhook = Boolean(
      req.header("x-corsair-webhook-secret") ||
      req.header("x-webhook-secret") ||
      req.header("x-goog-channel-id")
    );
    if (isWebhook) {
      req.url = "/corsair";
      return webhooksRouter(req, res, next);
    }
  }

  const handler = toExpressHandler(getCorsair(), { basePath: "/api/corsair" });
  void handler(req, res, next).catch(next);
});
