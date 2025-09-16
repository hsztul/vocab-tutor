import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db/client";
import { attempts, words, userSense, users } from "@/db/schema";
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

function naiveScoreMultiple(definitions: Array<{definition: string, partOfSpeech: string}>, transcript: string): { score: number; pass: boolean; feedback: string } {
  const tr = transcript.toLowerCase();
  let bestScore = 0;
  let bestMatch: {definition: string, partOfSpeech: string} | null = null;
  let bestResult: { score: number; pass: boolean; feedback: string } | null = null;
  
  // Try scoring against each definition and keep the best result
  for (const def of definitions) {
    const result = naiveScore(def.definition, transcript);
    if (result.score > bestScore) {
      bestScore = result.score;
      bestMatch = def;
      bestResult = result;
    }
  }
  
  if (!bestResult || !bestMatch) {
    return { score: 0, pass: false, feedback: "No valid definitions found to compare against." };
  }
  
  // Enhance feedback to mention which definition was matched
  let enhancedFeedback = bestResult.feedback;
  if (definitions.length > 1) {
    if (bestResult.pass) {
      enhancedFeedback = `Great! Your definition matches the ${bestMatch.partOfSpeech} meaning of the word. ` + enhancedFeedback;
    } else {
      enhancedFeedback += ` Note: This word has multiple meanings (${definitions.map(d => d.partOfSpeech).join(', ')}). Your answer was closest to the ${bestMatch.partOfSpeech} definition.`;
    }
  }
  
  return {
    score: bestResult.score,
    pass: bestResult.pass,
    feedback: enhancedFeedback
  };
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
  const wordId = body?.wordId as string | undefined;
  const transcript = body?.transcript as string | undefined;
  const durationMs = typeof body?.durationMs === "number" ? Math.max(0, Math.floor(body.durationMs)) : null;
  if (!wordId || !transcript) return new NextResponse("Missing wordId or transcript", { status: 400 });

  // Load target word
  const [wordRow] = await db
    .select({
      id: words.id,
      word: words.word,
    })
    .from(words)
    .where(eq(words.id, wordId as any))
    .limit(1);
  if (!wordRow) return new NextResponse("Word not found", { status: 404 });

  // Fetch all definitions from dictionary API
  let allDefinitions: Array<{definition: string, partOfSpeech: string, example?: string}> = [];
  let dictData: any = null;
  
  try {
    const dictResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/dictionary/${encodeURIComponent(wordRow.word)}`);
    if (dictResponse.ok) {
      dictData = await dictResponse.json();
      if (dictData.meanings && dictData.meanings.length > 0) {
        // Collect all definitions across all meanings
        allDefinitions = dictData.meanings.flatMap((meaning: any) =>
          meaning.definitions.map((def: any) => ({
            definition: def.definition,
            partOfSpeech: meaning.partOfSpeech,
            example: def.example || ""
          }))
        );
      }
    }
  } catch (error) {
    console.error("Failed to fetch dictionary data:", error);
    return new NextResponse("Failed to fetch word definition", { status: 500 });
  }

  if (allDefinitions.length === 0) {
    return new NextResponse("No definition found for this word", { status: 404 });
  }

  // Use the first definition as primary for backwards compatibility
  const primaryDefinition = allDefinitions[0];
  const definition = primaryDefinition.definition;
  const partOfSpeech = primaryDefinition.partOfSpeech;
  const example = primaryDefinition.example;

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
      const system = `You are an expert SAT vocabulary tutor grading student definitions. The word may have multiple valid definitions across different parts of speech. Give credit if the student captures any of the valid meanings.

Return strict JSON with these keys:
- score (0..1): Numerical accuracy score
- pass (boolean): Whether the definition demonstrates understanding (score >= 0.7)
- feedback (string): Helpful explanation focusing on what they got right and what to improve
- keyPoints (array): 1-2 key concepts they captured or missed

Guidelines for feedback:
- Give credit for capturing any valid definition of the word
- Start positive when possible ("Good job capturing...")
- Be specific about what was right/wrong
- If they got a different but valid meaning, acknowledge it
- Suggest improvements for incorrect answers
- Keep it encouraging and educational
- Focus on meaning, not exact wording`;

      const allDefinitionsText = allDefinitions.map((def, index) => 
        `${index + 1}. (${def.partOfSpeech}) ${def.definition}${def.example ? ` - Example: ${def.example}` : ''}`
      ).join('\n');

      const user = `Word: ${wordRow.word}

All Valid Definitions:
${allDefinitionsText}

Student Response: "${transcript}"

Grade this definition considering all valid meanings. Give credit if they capture any of the definitions above.`;
      
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
      const res = naiveScoreMultiple(allDefinitions, transcript);
      score = res.score;
      passed = res.pass;
      feedback = res.feedback;
    }
  } else {
    const res = naiveScoreMultiple(allDefinitions, transcript);
    score = res.score;
    passed = res.pass;
    feedback = res.feedback;
  }

  const attemptId = uuidv4();
  await db.insert(attempts).values({
    id: attemptId as any,
    userId,
    wordId: wordId as any,
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
      wordId: wordId as any,
      firstSeenAt: sql`now()` as any,
      reviewedAt: sql`now()` as any,
      lastAttemptAt: sql`now()` as any,
      passCount: passed ? 1 : 0,
      failCount: passed ? 0 : 1,
      passedAt: passed ? (sql`now()` as any) : null,
      lastResult: passed ? "pass" : "fail",
    })
    .onConflictDoUpdate({
      target: [userSense.userId, userSense.wordId],
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
