const { Pool } = require('pg');
require('dotenv').config({ path: '../../.env' }); // load from project root .env

const connectionString = process.env.DATABASE_URL;
console.log("Connecting to PostgreSQL database...");

const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes('neon.tech') ? { rejectUnauthorized: false } : false
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

  // Check row count only — avoid selecting or logging sensitive account data
  try {
    const accountsRes = await pool.query(`SELECT COUNT(*)::int AS count FROM corsair_accounts;`);
    console.log(`\nFound ${accountsRes.rows[0]?.count ?? 0} accounts in corsair_accounts.`);
  } catch (err) {
    console.error("Failed to query corsair_accounts table:", err.message);
  }
}

main()
  .catch((err) => console.error("Error running query script:", err.message))
  .finally(() => pool.end());
