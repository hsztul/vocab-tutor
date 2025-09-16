#!/usr/bin/env tsx

import { db } from "../src/db/client";
import { words } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs";
import * as path from "path";

interface SATWordEntry {
  word: string;
  senses: Array<{
    pos: string | null;
    definition: string;
    example: string | null;
  }>;
}

async function syncSATWords() {
  console.log("🔄 Starting SAT vocabulary sync...");

  // Read the SAT vocabulary analysis file
  const jsonPath = path.join(__dirname, "../src/data/sat_vocab_analysis.json");
  const jsonContent = fs.readFileSync(jsonPath, "utf-8");
  const satWords: SATWordEntry[] = JSON.parse(jsonContent);

  console.log(`📚 Found ${satWords.length} words in SAT vocabulary file`);

  // Get existing words from database
  const existingWords = await db.select({ word: words.word }).from(words);
  const existingWordSet = new Set(existingWords.map(w => w.word.toLowerCase()));

  console.log(`💾 Found ${existingWords.length} words already in database`);

  // Find words that need to be inserted
  const wordsToInsert = satWords.filter(satWord => 
    !existingWordSet.has(satWord.word.toLowerCase())
  );

  console.log(`➕ Need to insert ${wordsToInsert.length} new words`);

  if (wordsToInsert.length === 0) {
    console.log("✅ All SAT words are already in the database!");
    return;
  }

  // Insert missing words in batches
  const batchSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < wordsToInsert.length; i += batchSize) {
    const batch = wordsToInsert.slice(i, i + batchSize);
    
    const wordsData = batch.map(satWord => ({
      id: uuidv4() as any,
      word: satWord.word,
    }));

    try {
      await db.insert(words).values(wordsData);
      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${Math.ceil((i + 1) / batchSize)} (${insertedCount}/${wordsToInsert.length} words)`);
    } catch (error) {
      console.error(`❌ Error inserting batch ${Math.ceil((i + 1) / batchSize)}:`, error);
      // Continue with next batch
    }
  }

  console.log(`🎉 Successfully inserted ${insertedCount} new words!`);
  
  // Verify final count
  const finalCount = await db.select({ count: words.word }).from(words);
  console.log(`📊 Total words in database: ${finalCount.length}`);
}

// Run the sync
syncSATWords()
  .then(() => {
    console.log("✅ SAT vocabulary sync completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ SAT vocabulary sync failed:", error);
    process.exit(1);
  });
