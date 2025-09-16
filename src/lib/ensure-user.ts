import { db } from "@/db/client";
import { sql } from "drizzle-orm";

// Ensure there's a corresponding row for the authenticated Clerk user
// Safe to call on every request; it is idempotent due to onConflictDoNothing
export async function ensureUserRecord(userId: string | null | undefined) {
  if (!db || !userId) return;
  // Insert both id and clerk_id (DB has clerk_id NOT NULL)
  await db.execute(sql`insert into "users" ("id", "clerk_id") values (${userId}, ${userId}) on conflict do nothing`);
}
