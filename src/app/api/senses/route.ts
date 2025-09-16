import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { senses, words, userSense } from "@/db/schema";
import { and, count, eq, isNotNull, isNull } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!db) return new NextResponse("Database not configured", { status: 500 });

  const { userId } = await auth();
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "review").toLowerCase();
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  // Precompute total senses per word
  const counts = await db
    .select({ wordId: senses.wordId, total: count() })
    .from(senses)
    .groupBy(senses.wordId);
  const totalByWord = new Map(counts.map((c) => [c.wordId, Number(c.total)]));

  if (mode === "test") {
    if (!userId) return NextResponse.json({ items: [], total: 0 });

    // Only senses the user explicitly queued for testing and not yet passed
    const base = await db
      .select({
        id: senses.id,
        word: words.word,
        pos: senses.pos,
        definition: senses.definition,
        example: senses.example,
        ordinal: senses.ordinal,
        wordId: senses.wordId,
        queued: userSense.queued,
      })
      .from(senses)
      .innerJoin(words, eq(senses.wordId, words.id))
      .innerJoin(
        userSense,
        and(
          eq(userSense.senseId, senses.id),
          eq(userSense.userId, userId),
          eq(userSense.queued, true),
          isNull(userSense.passedAt)
        )
      )
      .orderBy(words.word, senses.ordinal)
      .limit(limit)
      .offset(offset);

    const items = base.map((row) => ({
      id: row.id,
      word: row.word,
      pos: row.pos,
      definition: row.definition,
      example: row.example ?? undefined,
      ordinal: row.ordinal ?? 0,
      totalSensesForWord: totalByWord.get(row.wordId) ?? 1,
      queued: !!row.queued,
    }));

    // total for pagination
    const [{ total }] = await db
      .select({ total: count() })
      .from(userSense)
      .where(and(eq(userSense.userId, userId), eq(userSense.queued, true), isNull(userSense.passedAt)));

    return NextResponse.json({ items, total: Number(total) });
  }

  // review: plain list; include queued state if exists for this user
  const base = await db
    .select({
      id: senses.id,
      word: words.word,
      pos: senses.pos,
      definition: senses.definition,
      example: senses.example,
      ordinal: senses.ordinal,
      wordId: senses.wordId,
      queued: userSense.queued,
    })
    .from(senses)
    .innerJoin(words, eq(senses.wordId, words.id))
    .leftJoin(
      userSense,
      and(eq(userSense.senseId, senses.id), userId ? eq(userSense.userId, userId) : eq(userSense.userId, "__none__" as any))
    )
    .orderBy(words.word, senses.ordinal)
    .limit(limit)
    .offset(offset);

  const items = base.map((row) => ({
    id: row.id,
    word: row.word,
    pos: row.pos,
    definition: row.definition,
    example: row.example ?? undefined,
    ordinal: row.ordinal ?? 0,
    totalSensesForWord: totalByWord.get(row.wordId) ?? 1,
    queued: !!row.queued,
  }));

  const [{ total }] = await db.select({ total: count() }).from(senses);
  return NextResponse.json({ items, total: Number(total) });
}
