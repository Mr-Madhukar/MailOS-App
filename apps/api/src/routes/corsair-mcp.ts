/**
 * Official Corsair MCP adapter (@corsair-dev/mcp) — exposes corsair_setup,
 * list_operations, get_schema, run_script, and request_permission per Corsair docs.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";

import { createBaseMcpServer, createMcpRouter } from "@corsair-dev/mcp";
import type { PermissionAdapter } from "@corsair-dev/mcp";
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";

import { getCorsair, getCorsairPool, isCorsairConfigured } from "../corsair";
import { env } from "../env";
import { resolveMcpUserId } from "../mcp-auth";

/** Store the authenticated user id for the lifetime of each MCP request. */
const mcpUserStore = new AsyncLocalStorage<{ userId: string }>();

export const corsairMcpGate = Router();

corsairMcpGate.use((_req, res, next) => {
  if (!isCorsairConfigured()) {
    return res.status(503).json({
      error: "Corsair is not configured (set CORSAIR_KEK and DATABASE_URL)",
    });
  }
  next();
});

/** Same auth model as /mcp — session cookies or bound THREAD_MCP_API_KEY + THREAD_MCP_USER_ID. */
corsairMcpGate.use(async (req: Request, res: Response, next: NextFunction) => {
  const userId = await resolveMcpUserId(req);
  if (!userId) {
    return res.status(401).json({
      error: "Authentication required. Sign in via Thread or use Authorization: Bearer <THREAD_MCP_API_KEY>.",
    });
  }
  // Run the remainder of the request inside the AsyncLocalStorage scope
  // so the permission adapter can access the userId.
  mcpUserStore.run({ userId }, () => next());
});

/**
 * PermissionAdapter bridges the MCP `request_permission` tool to Thread's
 * existing corsair_permissions table and approval UI.
 */
const permissionAdapter: PermissionAdapter = {
  async createPermissionRequest({ endpoint, args }) {
    const store = mcpUserStore.getStore();
    const tenantId = store?.userId ?? "default";
    const pool = getCorsairPool();
    const permissionId = crypto.randomUUID();
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    // Derive plugin name from the endpoint (e.g. "gmail.messages.send" → "gmail")
    const plugin = endpoint.split(".")[0] ?? "unknown";

    await pool.query(
      `INSERT INTO corsair_permissions (id, token, plugin, endpoint, args, tenant_id, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)`,
      [permissionId, token, plugin, endpoint, JSON.stringify(args), tenantId, expiresAt],
    );

    const approvalUrl = `${env.CLIENT_URL}/corsair/approve/${token}`;

    return { permissionId, approvalUrl };
  },
};

export const corsairOfficialMcpRouter = createMcpRouter(() =>
  createBaseMcpServer({
    corsair: getCorsair() as { [key: string]: unknown },
    permissions: permissionAdapter,
    setup: true,
    basePermissionUrl: `${env.CLIENT_URL}/corsair/approve`,
  }),
);
