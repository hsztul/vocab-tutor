import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { userSense, senses, words } from "@/db/schema";
import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { ensureUserRecord } from "@/lib/ensure-user";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  if (!db) return new NextResponse("Database not configured", { status: 500 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ words: [] });
  await ensureUserRecord(userId);

  // Get word-level progress roll-ups
  const wordProgress = await db
    .select({
      word: words.word,
      totalSenses: count(senses.id),
      reviewedSenses: sql<number>`COUNT(CASE WHEN ${userSense.reviewedAt} IS NOT NULL THEN 1 END)`,
      passedSenses: sql<number>`COUNT(CASE WHEN ${userSense.passedAt} IS NOT NULL THEN 1 END)`,
    })
    .from(words)
    .innerJoin(senses, eq(senses.wordId, words.id))
    .leftJoin(
      userSense,
      and(eq(userSense.senseId, senses.id), eq(userSense.userId, userId))
    )
    .groupBy(words.id, words.word)
    .orderBy(words.word);

  // Calculate completion rates
  const wordsWithProgress = wordProgress.map((word) => ({
    word: word.word,
    totalSenses: Number(word.totalSenses),
    reviewedSenses: Number(word.reviewedSenses),
    passedSenses: Number(word.passedSenses),
    completionRate: word.totalSenses > 0 
      ? Math.round((Number(word.passedSenses) / Number(word.totalSenses)) * 100)
      : 0,
  }));

  return NextResponse.json({ words: wordsWithProgress });
}
