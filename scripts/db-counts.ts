import { config } from 'dotenv';
config();
config({ path: '.env.local', override: false });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const db = drizzle(neon(url));

  const [{ words }]: any = await db.execute(sql`SELECT COUNT(*)::int AS words FROM words;`);
  const [{ senses }]: any = await db.execute(sql`SELECT COUNT(*)::int AS senses FROM senses;`);

  console.log(`Words: ${words} | Senses: ${senses}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
