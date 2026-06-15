import { defineConfig } from 'drizzle-kit';
import fs from 'fs';
import path from 'path';

// Read .env file manually to ensure it's loaded
let databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const match = envContent.match(/^DATABASE_URL\s*=\s*(.+)$/m);
      if (match) {
        databaseUrl = match[1].trim().replace(/^["']|["']$/g, ''); // strip optional quotes
      }
    }
  } catch (err) {
    console.error('Failed to read .env file:', err);
  }
}

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl || 'postgresql://postgres:postgres@localhost:5432/mailos',
  },
});
