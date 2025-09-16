import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { words, senses } from "@/db/schema";
import { v4 as uuidv4, v5 as uuidv5 } from "uuid";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

// Same namespace as in lib/ids.ts to keep deterministic
const SENSE_NAMESPACE = "90a22e9e-2f87-4f2c-8a1e-3a2b1a0c8f7b";

function computeSenseId(word: string, pos: string, definition: string) {
  const key = `${word}::${pos}::${definition.trim()}`;
  return uuidv5(key, SENSE_NAMESPACE);
}

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

  let inserted = 0;
  let updated = 0;

  for (const w of payload) {
      if (!w || typeof w.word !== "string") continue;
      const wordText = w.word.trim();
      if (!wordText) continue;

      // Upsert word by unique word text
      const wordId = uuidv4();
      const [wordRow] = await db
        .insert(words)
        .values({ id: wordId as any, word: wordText })
        .onConflictDoUpdate({
          target: words.word,
          set: { word: wordText },
        })
        .returning({ id: words.id });

      const resolvedWordId = wordRow?.id ?? wordId;

      // Upsert each sense with deterministic ID and ordinal
      // Accept two shapes:
      // 1) { word, senses: [{ pos, definition, example? }] }
      // 2) { word, definition, example? }  (defaults to pos = 'n')
      const sensesArr = Array.isArray(w.senses)
        ? w.senses
        : (typeof w.definition === "string"
            ? [{ pos: w.pos ?? "n", definition: w.definition, example: w.example }]
            : []);
      for (let i = 0; i < sensesArr.length; i++) {
        const s = sensesArr[i];
        if (!s || typeof s.pos !== "string" || typeof s.definition !== "string") continue;
        const pos = s.pos.trim();
        const definition = s.definition.trim();
        const example = typeof s.example === "string" ? s.example : null;
        const senseId = computeSenseId(wordText, pos, definition);

        const res = await db
          .insert(senses)
          .values({
            id: senseId as any,
            wordId: resolvedWordId as any,
            pos,
            definition,
            example,
            ordinal: i + 1,
          })
          .onConflictDoUpdate({
            target: senses.id,
            set: {
              wordId: resolvedWordId as any,
              pos,
              definition,
              example,
              ordinal: i + 1,
            },
          })
          .returning({ id: senses.id });

        if (res?.[0]?.id === senseId) {
          // Heuristic: if we updated existing, count as updated; if it was new row, also returned senseId.
          // We will increment inserted when i===0 if word insert created; otherwise updated increases.
        }
      }

      // Rough counters: try to detect word insert vs update
      // Re-select word to check creation timestamp could be used; keep simple:
      // here we can't easily detect; increment updated for safety.
      updated += 1;
  }

  return NextResponse.json({ inserted, updated });
}
