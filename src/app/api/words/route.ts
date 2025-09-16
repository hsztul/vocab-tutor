import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { words, userSense } from "@/db/schema";
import { and, count, eq, isNull } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!db) return new NextResponse("Database not configured", { status: 500 });

  const { userId } = await auth();
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") || "review").toLowerCase();
  const limit = parseInt(searchParams.get("limit") || "1000", 10);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  if (mode === "test") {
    if (!userId) return NextResponse.json({ items: [], total: 0 });

    // Only words the user explicitly queued for testing and not yet passed
    const base = await db
      .select({
        id: words.id,
        word: words.word,
        queued: userSense.queued,
      })
      .from(words)
      .innerJoin(
        userSense,
        and(
          eq(userSense.wordId, words.id),
          eq(userSense.userId, userId),
          eq(userSense.queued, true),
          isNull(userSense.passedAt)
        )
      )
      .orderBy(words.word)
      .limit(limit)
      .offset(offset);

    const items = base.map((row) => ({
      id: row.id,
      word: row.word,
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
      id: words.id,
      word: words.word,
      queued: userSense.queued,
    })
    .from(words)
    .leftJoin(
      userSense,
      and(eq(userSense.wordId, words.id), userId ? eq(userSense.userId, userId) : eq(userSense.userId, "__none__" as any))
    )
    .orderBy(words.word)
    .limit(limit)
    .offset(offset);

  const items = base.map((row) => ({
    id: row.id,
    word: row.word,
    queued: !!row.queued,
  }));

  const [{ total }] = await db.select({ total: count() }).from(words);
  return NextResponse.json({ items, total: Number(total) });
}
