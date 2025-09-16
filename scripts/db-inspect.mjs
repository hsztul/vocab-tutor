import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(url);

async function main() {
  const tables = await sql`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name;
  `;

  console.log('Existing public tables:');
  for (const row of tables) {
    console.log('-', row.table_name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
