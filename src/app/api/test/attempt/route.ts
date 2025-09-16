import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { attempts, senses, words, userSense, users } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = "nodejs";

function naiveScore(reference: string, transcript: string): { score: number; pass: boolean; feedback: string } {
  const ref = reference.toLowerCase();
  const tr = transcript.toLowerCase();
  // Token overlap heuristic
  const tokens = Array.from(new Set(ref.split(/[^a-z]+/).filter(Boolean)));
  const matched = tokens.filter((t) => tr.includes(t)).length;
  const score = tokens.length ? matched / tokens.length : 0;
  const pass = score >= 0.6;
  
  let feedback = "";
  if (pass) {
    feedback = `Good job! Your definition captures ${matched} out of ${tokens.length} key concepts from the target definition.`;
    if (matched === tokens.length) {
      feedback += " You got all the main ideas!";
    } else {
      const missing = tokens.filter((t) => !tr.includes(t));
      feedback += ` Consider including: ${missing.slice(0, 2).join(", ")}.`;
    }
  } else {
    feedback = `Your definition needs work. You captured ${matched} out of ${tokens.length} key concepts.`;
    const missing = tokens.filter((t) => !tr.includes(t));
    feedback += ` Try to include these key ideas: ${missing.slice(0, 3).join(", ")}.`;
  }
  
  return { score, pass, feedback };
}

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
  const senseId = body?.senseId as string | undefined;
  const transcript = body?.transcript as string | undefined;
  const durationMs = typeof body?.durationMs === "number" ? Math.max(0, Math.floor(body.durationMs)) : null;
  if (!senseId || !transcript) return new NextResponse("Missing senseId or transcript", { status: 400 });

  // Load target sense + word
  const [row] = await db
    .select({
      id: senses.id,
      word: words.word,
      pos: senses.pos,
      definition: senses.definition,
      example: senses.example,
    })
    .from(senses)
    .innerJoin(words, eq(senses.wordId, words.id))
    .where(eq(senses.id, senseId as any))
    .limit(1);
  if (!row) return new NextResponse("Sense not found", { status: 404 });

  // Ensure user exists to satisfy FK constraints
  await db
    .insert(users)
    .values({ id: userId, clerkId: userId })
    .onConflictDoNothing();

  let score = 0;
  let passed = false;
  let feedback = "";

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const system = `You are an expert SAT vocabulary tutor grading student definitions. Provide constructive, encouraging feedback that helps students learn.

Return strict JSON with these keys:
- score (0..1): Numerical accuracy score
- pass (boolean): Whether the definition demonstrates understanding (score >= 0.7)
- feedback (string): Helpful explanation focusing on what they got right and what to improve
- keyPoints (array): 1-2 key concepts they captured or missed

Guidelines for feedback:
- Start positive when possible ("Good job capturing...")
- Be specific about what was right/wrong
- Suggest improvements for incorrect answers
- Keep it encouraging and educational
- Focus on meaning, not exact wording`;

      const user = `Word: ${row.word} (${row.pos})
Target Definition: ${row.definition}
${row.example ? `Example: ${row.example}` : ''}

Student Response: "${transcript}"

Grade this definition and provide helpful feedback.`;
      
      const { text } = await generateText({
        model: openai('gpt-5-nano'),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ]
      });
      
      const parsed = JSON.parse(text);
      score = Math.max(0, Math.min(1, Number(parsed.score ?? 0)));
      passed = Boolean(parsed.pass ?? score >= 0.7);
      feedback = String(parsed.feedback ?? "");
      
      // Include key points in feedback if available
      if (parsed.keyPoints && Array.isArray(parsed.keyPoints) && parsed.keyPoints.length > 0) {
        const keyPointsText = parsed.keyPoints.map((point: string) => `• ${point}`).join('\n');
        feedback = `${feedback}\n\nKey Points:\n${keyPointsText}`;
      }
    } catch (e) {
      const res = naiveScore(row.definition, transcript);
      score = res.score;
      passed = res.pass;
      feedback = res.feedback;
    }
  } else {
    const res = naiveScore(row.definition, transcript);
    score = res.score;
    passed = res.pass;
    feedback = res.feedback;
  }

  const attemptId = uuidv4();
  await db.insert(attempts).values({
    id: attemptId as any,
    userId,
    senseId: senseId as any,
    transcript,
    model: process.env.OPENAI_API_KEY ? "gpt-5-nano" : "naive",
    score,
    pass: passed,
    feedback,
    durationMs: durationMs ?? null,
  });

  // Upsert user_sense progress
  await db
    .insert(userSense)
    .values({
      id: uuidv4() as any,
      userId,
      senseId: senseId as any,
      firstSeenAt: sql`now()` as any,
      reviewedAt: sql`now()` as any,
      lastAttemptAt: sql`now()` as any,
      passCount: passed ? 1 : 0,
      failCount: passed ? 0 : 1,
      passedAt: passed ? (sql`now()` as any) : null,
      lastResult: passed ? "pass" : "fail",
    })
    .onConflictDoUpdate({
      target: [userSense.userId, userSense.senseId],
      set: {
        reviewedAt: sql`coalesce(${userSense.reviewedAt}, now())` as any,
        firstSeenAt: sql`coalesce(${userSense.firstSeenAt}, now())` as any,
        lastAttemptAt: sql`now()` as any,
        passCount: passed ? (sql`${userSense.passCount} + 1` as any) : (sql`${userSense.passCount}` as any),
        failCount: passed ? (sql`${userSense.failCount}` as any) : (sql`${userSense.failCount} + 1` as any),
        passedAt: passed ? (sql`coalesce(${userSense.passedAt}, now())` as any) : (sql`${userSense.passedAt}` as any),
        lastResult: passed ? "pass" : "fail",
      },
    });

  return NextResponse.json({ id: attemptId, pass: passed, score, feedback });
}
