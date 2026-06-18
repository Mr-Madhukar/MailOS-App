import "dotenv/config";
import { db } from "../src/server/corsair";
import { users, corsairAccounts } from "../src/server/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("=== DB CHECK START ===");
  
  // List users
  const allUsers = await db.select().from(users);
  console.log("Users in DB:", allUsers.map(u => ({ id: u.id, email: u.email, name: u.name })));

  // List corsair accounts
  const accounts = await db.select().from(corsairAccounts);
  console.log("Corsair Accounts in DB:", accounts.map(a => ({ id: a.id, tenantId: a.tenantId, integrationId: a.integrationId })));

  // If there's a user and a "default" tenant account, let's migrate "default" to the user's ID!
  if (allUsers.length > 0) {
    const primaryUser = allUsers[0];
    const defaultAccounts = accounts.filter(a => a.tenantId === "default");
    
    if (defaultAccounts.length > 0) {
      console.log(`\nMigrating ${defaultAccounts.length} default accounts to user: ${primaryUser.email} (${primaryUser.id})`);
      for (const account of defaultAccounts) {
        // Check if there is already an account for this user to avoid unique constraint violations
        const existingForUser = accounts.find(a => a.tenantId === primaryUser.id && a.integrationId === account.integrationId);
        if (existingForUser) {
          console.log(`- Account for integration ${account.integrationId} already exists for user. Deleting old default account.`);
          await db.delete(corsairAccounts).where(eq(corsairAccounts.id, account.id));
        } else {
          console.log(`- Updating tenantId for account ${account.id} to ${primaryUser.id}`);
          await db.update(corsairAccounts).set({ tenantId: primaryUser.id }).where(eq(corsairAccounts.id, account.id));
        }
      }
      console.log("Migration completed!");
    } else {
      console.log("\nNo 'default' tenant accounts found to migrate.");
    }
  } else {
    console.log("\nNo users found in database.");
  }

  console.log("=== DB CHECK END ===");
  process.exit(0);
}

main().catch(console.error);
