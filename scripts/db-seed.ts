import { config } from 'dotenv';
// Load .env then .env.local if present
config();
config({ path: '.env.local', override: false });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { words } from '../src/db/schema';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const neonClient = neon(url);
  const db = drizzle(neonClient);

  // Optionally clear existing data before seeding
  const shouldClear =
    process.argv.includes('--clear') ||
    process.env.CLEAR_BEFORE === '1' ||
    (process.env.CLEAR_BEFORE || '').toLowerCase() === 'true';
  if (shouldClear) {
    console.log('Clearing existing data: words ...');
    await db.execute(sql`DELETE FROM words;`);
    console.log('✓ Cleared words');
  }

  // Load dataset from JSON file (CLI arg or env DATA_FILE; default to analysis JSON)
  const argPath = process.argv.slice(2).find((a) => a && !a.startsWith('-')) ?? process.env.DATA_FILE;
  const rel = argPath ?? path.join('src', 'data', 'sat_vocab_analysis.json');
  const filePath = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  const raw = await readFile(filePath, 'utf8');
  const dataset = JSON.parse(raw);

  // Filter dataset to unique, non-empty words
  const valid = Array.from(
    new Set(
      (dataset as any[])
        .map((w) => (typeof w?.word === 'string' ? w.word.trim() : ''))
        .filter((w) => !!w)
    )
  );

  const batchSize = 200;
  let done = 0;
  const totalEntries = Array.isArray(dataset) ? dataset.length : 0;

  console.log(`Dataset entries: ${totalEntries}`);
  console.log(`Valid words: ${valid.length}`);
  console.log(`Seeding ${valid.length} words in batches of ${batchSize} ...`);

  for (let i = 0; i < valid.length; i += batchSize) {
    const slice = valid.slice(i, i + batchSize);

    for (const wordText of slice) {
      const wordId = uuidv4();
      await db
        .insert(words)
        .values({ id: wordId as any, word: wordText })
        .onConflictDoUpdate({ target: words.word, set: { word: wordText } });
    }

    done += slice.length;
    console.log(`  ✓ ${done} / ${valid.length}`);
  }

  console.log('Seeding complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
