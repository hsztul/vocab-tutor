import { db } from "@/db/client";
import { users } from "@/db/schema";

export async function ensureUserRecord(userId: string) {
  if (!db) return;
  
  await db
    .insert(users)
    .values({ id: userId, clerkId: userId })
    .onConflictDoNothing();
}
