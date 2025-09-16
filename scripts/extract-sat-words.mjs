#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the SAT vocabulary analysis file
const jsonPath = path.join(__dirname, '../src/data/sat_vocab_analysis.json');
const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
const satWords = JSON.parse(jsonContent);

console.log(`Found ${satWords.length} words in SAT vocabulary file`);

// Extract just the words
const wordsList = satWords.map(entry => entry.word).sort();

// Output the words for SQL insertion
console.log('\nWords to potentially insert:');
wordsList.forEach((word, index) => {
  console.log(`${index + 1}. ${word}`);
});

// Generate SQL INSERT statements
const sqlInserts = wordsList.map(word => {
  // Generate a simple UUID-like string for the ID
  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
  
  return `('${id}', '${word.replace(/'/g, "''")}')`;
}).join(',\n  ');

const fullSQL = `INSERT INTO words (id, word) VALUES
  ${sqlInserts}
ON CONFLICT (word) DO NOTHING;`;

// Write SQL to file
const sqlPath = path.join(__dirname, 'insert-sat-words.sql');
fs.writeFileSync(sqlPath, fullSQL);

console.log(`\nGenerated SQL file: ${sqlPath}`);
console.log(`Total words: ${wordsList.length}`);
