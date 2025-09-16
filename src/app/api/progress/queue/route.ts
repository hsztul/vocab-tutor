import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { userSense } from "@/db/schema";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { ensureUserRecord } from "@/lib/user-utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!db) return new NextResponse("Database not configured", { status: 500 });
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  const wordId = body?.wordId as string | undefined;
  const queued = typeof body?.queued === "boolean" ? body.queued : undefined;
  if (!wordId || typeof queued === "undefined") return new NextResponse("Missing wordId or queued", { status: 400 });

  // Ensure user exists to satisfy FK
  await ensureUserRecord(userId);

  await db
    .insert(userSense)
    .values({
      id: uuidv4() as any,
      userId,
      wordId: wordId as any,
      firstSeenAt: sql`now()` as any,
      reviewedAt: sql`now()` as any,
      queued,
    })
    .onConflictDoUpdate({
      target: [userSense.userId, userSense.wordId],
      set: {
        firstSeenAt: sql`coalesce(${userSense.firstSeenAt}, now())` as any,
        reviewedAt: sql`coalesce(${userSense.reviewedAt}, now())` as any,
        queued,
      },
    });

  return NextResponse.json({ success: true });
}
