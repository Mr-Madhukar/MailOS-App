import "dotenv/config";
import { corsair, db } from "../src/server/corsair";
import { ensureIntegrationAndAccount } from "../src/server/db/ensure";
import { hashPassword } from "../src/lib/password";
import { users } from "../src/server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function main() {
  console.log("🚀 Starting database seeding for Google OAuth credentials...");

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("❌ Missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET in .env");
    process.exit(1);
  }

  // 1. Ensure integrations and accounts are created in the database
  console.log("1. Ensuring database integration rows exist...");
  await ensureIntegrationAndAccount("gmail");
  await ensureIntegrationAndAccount("googlecalendar");

  // 2. Programmatically configure credentials using Corsair key manager APIs
  console.log("2. Configuring Gmail integration credentials...");
  await corsair.keys.gmail.set_client_id(clientId);
  await corsair.keys.gmail.set_client_secret(clientSecret);
  await corsair.keys.gmail.set_redirect_url("http://localhost:3000/api/auth/callback");

  console.log("3. Configuring Google Calendar integration credentials...");
  await corsair.keys.googlecalendar.set_client_id(clientId);
  await corsair.keys.googlecalendar.set_client_secret(clientSecret);
  await corsair.keys.googlecalendar.set_redirect_url("http://localhost:3000/api/auth/callback");

  // 4. Seed demo user
  console.log("4. Seeding demo user (rithb8981@gmail.com)...");
  const demoEmail = "rithb8981@gmail.com";
  const demoPassword = "Rithb@8981";
  const demoUser = await db
    .select()
    .from(users)
    .where(eq(users.email, demoEmail))
    .then((rows) => rows[0]);

  const passwordHash = hashPassword(demoPassword);

  if (demoUser) {
    console.log("   Demo user already exists. Updating password hash...");
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.email, demoEmail));
  } else {
    console.log("   Demo user does not exist. Creating...");
    await db.insert(users).values({
      id: crypto.randomUUID(),
      email: demoEmail,
      name: "Demo User",
      passwordHash,
    });
  }

  console.log("✅ Seeding completed! Google OAuth credentials and demo user successfully configured in the database.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
