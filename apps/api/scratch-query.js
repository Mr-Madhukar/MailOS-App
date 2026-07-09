import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); // load from project root .env

const connectionString = process.env.DATABASE_URL;
console.log("Connecting to:", connectionString ? connectionString.split('@')[1] : "undefined");

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false
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

  // Let's also check if there are any rows in corsair_accounts
  try {
    const accountsRes = await pool.query(`SELECT * FROM corsair_accounts;`);
    console.log(`\nFound ${accountsRes.rows.length} accounts in corsair_accounts:`);
    console.log(accountsRes.rows);
  } catch (err) {
    console.error("Failed to query corsair_accounts table:", err.message);
  }
}

main().catch(console.error).finally(() => pool.end());
