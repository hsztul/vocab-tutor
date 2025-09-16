import { config } from 'dotenv';
// Load .env then .env.local if present
config();
config({ path: '.env.local', override: false });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { words, senses } from '../src/db/schema';

const SENSE_NAMESPACE = '90a22e9e-2f87-4f2c-8a1e-3a2b1a0c8f7b';
const computeSenseId = (word: string, pos: string, definition: string) =>
  uuidv5(`${word}::${pos}::${definition.trim()}`, SENSE_NAMESPACE);

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
    console.log('Clearing existing data: senses, words ...');
    await db.execute(sql`DELETE FROM senses;`);
    await db.execute(sql`DELETE FROM words;`);
    console.log('✓ Cleared senses and words');
  }

  // Load dataset from JSON file (CLI arg or env DATA_FILE; default to analysis JSON)
  const argPath = process.argv.slice(2).find((a) => a && !a.startsWith('-')) ?? process.env.DATA_FILE;
  const rel = argPath ?? path.join('src', 'data', 'sat_vocab_analysis.json');
  const filePath = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  const raw = await readFile(filePath, 'utf8');
  const dataset = JSON.parse(raw);

  // Filter and normalize dataset (default missing POS to 'n')
  const valid = (dataset as any[])
    .map((w) => {
      const word = typeof w?.word === 'string' ? w.word.trim() : '';
      const rawSenses: any[] = Array.isArray(w?.senses) ? w.senses : [];
      const normalized: { pos: string; definition: string; example: string | null }[] = [];
      const seen = new Set<string>();
      for (const s of rawSenses) {
        const definition = typeof s?.definition === 'string' ? s.definition.trim() : '';
        if (!definition) continue;
        const pos = typeof s?.pos === 'string' && s.pos.trim() ? s.pos.trim().toLowerCase() : 'n';
        const example = typeof s?.example === 'string' ? s.example : null;
        const id = computeSenseId(word, pos, definition);
        if (seen.has(id)) continue; // de-duplicate per word
        seen.add(id);
        normalized.push({ pos, definition, example });
      }
      return { word, senses: normalized };
    })
    .filter((w) => w.word && w.senses.length > 0);

  const batchSize = 200;
  let done = 0;
  const totalEntries = Array.isArray(dataset) ? dataset.length : 0;
  const totalSenses = valid.reduce((acc, w) => acc + w.senses.length, 0);

  console.log(`Dataset entries: ${totalEntries}`);
  console.log(`Valid words: ${valid.length} | Total senses: ${totalSenses}`);
  console.log(`Seeding ${valid.length} words in batches of ${batchSize} ...`);

  for (let i = 0; i < valid.length; i += batchSize) {
    const slice = valid.slice(i, i + batchSize);

    for (const w of slice) {
      const wordId = uuidv4();
      const [wordRow] = await db
        .insert(words)
        .values({ id: wordId as any, word: w.word })
        .onConflictDoUpdate({ target: words.word, set: { word: w.word } })
        .returning({ id: words.id });

      const resolvedWordId = wordRow?.id ?? wordId;

      for (let idx = 0; idx < w.senses.length; idx++) {
        const s = w.senses[idx];
        const pos = s.pos; // already normalized and non-empty
        const definition = s.definition; // already normalized
        const example = s.example;
        const senseId = computeSenseId(w.word, pos, definition);

        await db
          .insert(senses)
          .values({
            id: senseId as any,
            wordId: resolvedWordId as any,
            pos,
            definition,
            example,
            ordinal: idx + 1,
          })
          .onConflictDoUpdate({
            target: senses.id,
            set: { wordId: resolvedWordId as any, pos, definition, example, ordinal: idx + 1 },
          });
      }
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
