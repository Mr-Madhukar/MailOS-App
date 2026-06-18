import "dotenv/config";
import { db } from "../src/server/corsair";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Enabling pgvector extension...");
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log("pgvector extension enabled successfully!");
  } catch (error) {
    console.error("Failed to enable pgvector extension:", error);
  }
  process.exit(0);
}

main();
