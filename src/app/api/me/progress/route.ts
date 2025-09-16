import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { userSense, words } from "@/db/schema";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { ensureUserRecord } from "@/lib/user-utils";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  if (!db) return new NextResponse("Database not configured", { status: 500 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ passed: 0, reviewed: 0, totalWords: 0 });
  await ensureUserRecord(userId);

  const [{ totalWords }] = await db.select({ totalWords: count() }).from(words);

  const [{ reviewed }] = await db
    .select({ reviewed: count() })
    .from(userSense)
    .where(and(eq(userSense.userId, userId), isNotNull(userSense.reviewedAt)));

  const [{ passed }] = await db
    .select({ passed: count() })
    .from(userSense)
    .where(and(eq(userSense.userId, userId), isNotNull(userSense.passedAt)));

  return NextResponse.json({ passed: Number(passed), reviewed: Number(reviewed), totalWords: Number(totalWords) });
}
