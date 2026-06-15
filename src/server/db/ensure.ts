import { corsairIntegrations, corsairAccounts } from "./schema";
import { generateDEK, encryptDEK } from "corsair/core";
import { db } from "../corsair";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

export async function ensureIntegrationAndAccount(pluginId: string, tenantId = "default") {
  const kek = process.env.CORSAIR_KEK!;
  if (!kek) {
    throw new Error("CORSAIR_KEK environment variable is not defined");
  }

  // 1. Ensure Integration exists
  let integration = await db
    .select()
    .from(corsairIntegrations)
    .where(eq(corsairIntegrations.name, pluginId))
    .then((rows) => rows[0]);

  if (!integration) {
    const dek = generateDEK();
    const encryptedDek = await encryptDEK(dek, kek);
    const id = crypto.randomUUID();
    
    await db.insert(corsairIntegrations).values({
      id,
      name: pluginId,
      config: {},
      dek: encryptedDek,
    });

    integration = { id, name: pluginId, config: {}, dek: encryptedDek } as any;
  }

  // 2. Ensure Account exists
  const account = await db
    .select()
    .from(corsairAccounts)
    .where(
      and(
        eq(corsairAccounts.tenantId, tenantId),
        eq(corsairAccounts.integrationId, integration.id)
      )
    )
    .then((rows) => rows[0]);

  if (!account) {
    const dek = generateDEK();
    const encryptedDek = await encryptDEK(dek, kek);
    const id = crypto.randomUUID();

    await db.insert(corsairAccounts).values({
      id,
      tenantId,
      integrationId: integration.id,
      config: {},
      dek: encryptedDek,
    });
  }
}
