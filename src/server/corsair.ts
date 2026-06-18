import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createCorsair } from 'corsair';
import { googlecalendar } from '@corsair-dev/googlecalendar';
import { gmail } from '@corsair-dev/gmail';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool);

export const corsair = createCorsair({
    plugins: [googlecalendar(), gmail()],
    database: pool,
    kek: process.env.CORSAIR_KEK!,
    multiTenancy: true,
});