import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { userSense, senses } from "@/db/schema";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { ensureUserRecord } from "@/lib/ensure-user";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  if (!db) return new NextResponse("Database not configured", { status: 500 });
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ passed: 0, reviewed: 0, totalSenses: 0 });
  await ensureUserRecord(userId);

  const [{ totalSenses }] = await db.select({ totalSenses: count() }).from(senses);

  const [{ reviewed }] = await db
    .select({ reviewed: count() })
    .from(userSense)
    .where(and(eq(userSense.userId, userId), isNotNull(userSense.reviewedAt)));

  const [{ passed }] = await db
    .select({ passed: count() })
    .from(userSense)
    .where(and(eq(userSense.userId, userId), isNotNull(userSense.passedAt)));

  return NextResponse.json({ passed: Number(passed), reviewed: Number(reviewed), totalSenses: Number(totalSenses) });
}
