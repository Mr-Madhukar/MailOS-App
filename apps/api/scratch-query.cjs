/* eslint-disable @typescript-eslint/no-require-imports */
const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' }); // load from project root .env

const connectionString = process.env.DATABASE_URL;
console.log("Connecting to:", connectionString ? connectionString.split('@')[1] : "undefined");

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function main() {
  const indexesRes = await pool.query(`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'corsair_accounts';
  `);
  console.log("Indexes on corsair_accounts:");
  console.log(indexesRes.rows);

  const constraintsRes = await pool.query(`
    SELECT conname, pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_namespace n ON n.oid = c.connamespace 
    WHERE conrelid = 'corsair_accounts'::regclass;
  `);
  console.log("\nConstraints on corsair_accounts:");
  console.log(constraintsRes.rows);

  // Let's also check if there are any rows in corsair_accounts
  try {
    const accountsRes = await pool.query(`SELECT id, tenant_id, integration_id, config FROM corsair_accounts;`);
    console.log(`\nFound ${accountsRes.rows.length} accounts in corsair_accounts:`);
    console.log(accountsRes.rows);
  } catch (err) {
    console.error("Failed to query corsair_accounts table:", err.message);
  }
}

main().catch(console.error).finally(() => pool.end());
