import "dotenv/config";
import { db } from "../src/server/corsair";
import { corsairAccounts } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== MIGRATING TO MADHUKAR USER ===");
  const targetUserId = "fe41bc13-82ce-4f8f-b31c-03e068b807d5";
  const sourceUserId = "322b6c84-cb4f-4d0c-a87f-f41fb9f6011d"; // where the script put it

  const accounts = await db.select().from(corsairAccounts);
  const userAccounts = accounts.filter(a => a.tenantId === sourceUserId);

  for (const account of userAccounts) {
    console.log(`Migrating account ${account.id} (integration: ${account.integrationId}) to target user ${targetUserId}`);
    // Check if target user already has an account for this integration
    const existing = accounts.find(a => a.tenantId === targetUserId && a.integrationId === account.integrationId);
    if (existing) {
      console.log(`- Target user already has an account row ${existing.id}. Deleting it first.`);
      await db.delete(corsairAccounts).where(eq(corsairAccounts.id, existing.id));
    }
    await db.update(corsairAccounts).set({ tenantId: targetUserId }).where(eq(corsairAccounts.id, account.id));
  }

  console.log("Migration finished successfully!");
  process.exit(0);
}

main().catch(console.error);
