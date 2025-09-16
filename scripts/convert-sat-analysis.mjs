#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

// Run from project root: node web/scripts/convert-sat-analysis.mjs
// Reads docs/SAT_Complete_Vocabulary_Analysis.csv and writes web/src/data/sat_vocab_analysis.json

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (ch === '\r') {
        // ignore CR (will handle on LF)
      } else {
        field += ch;
      }
    }
  }
  // flush last field if any
  if (field.length > 0 || inQuotes || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function toStructured(entries) {
  // entries: array of objects with keys: Word, Definition
  // target: [{ word, senses: [{ pos, definition, example }] }]
  const byWord = new Map();
  for (const e of entries) {
    const word = (e.Word || '').trim();
    const definition = (e.Definition || '').trim();
    if (!word) continue;
    if (!byWord.has(word)) {
      byWord.set(word, { word, senses: [] });
    }
    const obj = byWord.get(word);
    // Avoid duplicate identical definitions
    const exists = obj.senses.some((s) => (s.definition || '') === definition);
    if (!exists) {
      obj.senses.push({ pos: null, definition, example: null });
    }
  }
  return Array.from(byWord.values());
}

async function main() {
  const csvPath = path.resolve('docs', 'SAT_Complete_Vocabulary_Analysis.csv');
  const outPath = path.resolve('web', 'src', 'data', 'sat_vocab_analysis.json');

  const csvRaw = await fs.readFile(csvPath, 'utf8');
  const rows = parseCSV(csvRaw);
  if (!rows.length) throw new Error('CSV appears empty');

  // Expect header: Word,Frequency,Appears In,Definition,Root Analysis
  const header = rows[0];
  const colIndex = {
    Word: header.indexOf('Word'),
    Definition: header.indexOf('Definition'),
  };
  if (colIndex.Word === -1 || colIndex.Definition === -1) {
    throw new Error('CSV header missing required columns Word/Definition');
  }

  const entries = rows.slice(1)
    .filter((r) => r && r.length > 0 && r.some((c) => c && c.trim().length))
    .map((r) => ({
      Word: r[colIndex.Word] ?? '',
      Definition: r[colIndex.Definition] ?? '',
    }));

  const structured = toStructured(entries);

  // Sort by word for stable output
  structured.sort((a, b) => a.word.localeCompare(b.word));

  const json = JSON.stringify(structured, null, 2);
  await fs.writeFile(outPath, json + '\n', 'utf8');
  console.log(`Wrote ${structured.length} entries to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
