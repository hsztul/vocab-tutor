import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { words } from "@/db/schema";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // AuthZ: allow only ADMIN_USER_IDS if provided; otherwise block
  const { userId } = await auth();
  const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!userId || (adminIds.length > 0 && !adminIds.includes(userId))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!db) {
    return new NextResponse("Database not configured", { status: 500 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(payload)) {
    return NextResponse.json({ error: "Expected an array of words" }, { status: 400 });
  }

  let upserted = 0;

  for (const w of payload) {
    if (!w || typeof w.word !== "string") continue;
    const wordText = w.word.trim();
    if (!wordText) continue;

    // Upsert word by unique word text
    const wordId = uuidv4();
    await db
      .insert(words)
      .values({ id: wordId as any, word: wordText })
      .onConflictDoUpdate({
        target: words.word,
        set: { word: wordText },
      });
    upserted += 1;
  }

  return NextResponse.json({ upserted });
}
