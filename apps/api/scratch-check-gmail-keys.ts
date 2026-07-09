import { createCorsair } from 'corsair';
import { gmail } from '@corsair-dev/gmail';
import { googlecalendar } from '@corsair-dev/googlecalendar';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

const connectionString = process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

const kek = process.env.CORSAIR_KEK!.trim();
const corsair = createCorsair({
  plugins: [
    gmail(),
    googlecalendar(),
  ],
  database: pool,
  kek,
  multiTenancy: true,
});

async function main() {
  const tenantId = 'f7e538e8-43e8-4f5f-9207-10d1829d6ce5'; // one of the tenants from DB
  const client = corsair.withTenant(tenantId);
  
  const gmailClient = client.gmail as unknown as {
    keys?: {
      get_access_token: () => Promise<unknown>;
    };
  };

  if (gmailClient.keys) {
    const keys = gmailClient.keys;
    console.log("Keys methods:", Object.keys(keys));
    const token = await keys.get_access_token();
    console.log("Access token exists:", Boolean(token));
  } else {
    console.log("gmail.keys is not defined");
  }
}

main().catch(console.error).finally(() => pool.end());
