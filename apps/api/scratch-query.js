import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); // load from project root .env

const connectionString = process.env.DATABASE_URL;
console.log("Connecting to PostgreSQL database...");

const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

async function main() {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE 'corsair_%';
  `);
  console.log("Corsair tables in DB:");
  console.log(tablesRes.rows.map(r => r.table_name));

  for (const row of tablesRes.rows) {
    const columnsRes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = $1;
    `, [row.table_name]);
    console.log(`\nColumns for ${row.table_name}:`);
    console.log(columnsRes.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }

  // Check row count only — avoid selecting or logging sensitive account data
  try {
    const accountsRes = await pool.query(`SELECT COUNT(*)::int AS count FROM corsair_accounts;`);
    console.log(`\nFound ${accountsRes.rows[0]?.count ?? 0} accounts in corsair_accounts.`);
  } catch (err) {
    console.error("Failed to query corsair_accounts table:", err.message);
  }
}

try {
  await main();
} catch (error) {
  console.error("Error running query script:", error.message);
} finally {
  await pool.end();
}

