import { pgTable, uuid, text, integer, timestamp, boolean, index, unique, doublePrecision } from "drizzle-orm/pg-core";

// users (aligning to existing DB where id is text)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  // Align to DB column name 'clerk_id'
  clerkId: text("clerk_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// words
export const words = pgTable("words", {
  id: uuid("id").primaryKey(),
  word: text("word").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Removed senses table - definitions now fetched dynamically from dictionary API

// user_sense - now references words directly instead of senses
export const userSense = pgTable(
  "user_sense",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    wordId: uuid("word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    passCount: integer("pass_count").notNull().default(0),
    failCount: integer("fail_count").notNull().default(0),
    passedAt: timestamp("passed_at", { withTimezone: true }),
    lastResult: text("last_result"), // 'pass' | 'fail' | 'skipped' (enforced in code)
    queued: boolean("queued").notNull().default(false),
  },
  (table) => ({
    userReviewedIdx: index("user_sense_user_reviewed_idx").on(table.userId, table.reviewedAt),
    userWordUnique: unique("user_sense_user_word_unique").on(table.userId, table.wordId),
    wordIdx: index("user_sense_word_idx").on(table.wordId),
  })
);

// attempts - now references words directly instead of senses
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    wordId: uuid("word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
    transcript: text("transcript").notNull(),
    model: text("model").notNull(),
    score: doublePrecision("score"), // 0..1 per PRD
    pass: boolean("pass").notNull().default(false),
    feedback: text("feedback"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("attempts_user_created_idx").on(table.userId, table.createdAt),
    wordIdx: index("attempts_word_idx").on(table.wordId),
  })
);
