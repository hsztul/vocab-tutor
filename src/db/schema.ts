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

// senses (deterministic id recommended: UUIDv5 over `${word}::${pos}::${definition.trim()}`)
export const senses = pgTable(
  "senses",
  {
    id: uuid("id").primaryKey(),
    wordId: uuid("word_id").notNull().references(() => words.id, { onDelete: "cascade" }),
    pos: text("pos").notNull(),
    definition: text("definition").notNull(),
    example: text("example"),
    ordinal: integer("ordinal"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    wordOrdinalIdx: index("senses_word_ordinal_idx").on(table.wordId, table.ordinal),
  })
);

// user_sense
export const userSense = pgTable(
  "user_sense",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senseId: uuid("sense_id").notNull().references(() => senses.id, { onDelete: "cascade" }),
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
    userSenseUnique: unique("user_sense_user_sense_unique").on(table.userId, table.senseId),
  })
);

// attempts
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    senseId: uuid("sense_id").notNull().references(() => senses.id, { onDelete: "cascade" }),
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
  })
);
