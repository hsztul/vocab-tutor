import { NextRequest, NextResponse } from "next/server";
import { experimental_transcribe as transcribe } from 'ai';
import { openai } from '@ai-sdk/openai';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI not configured" }, { status: 501 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
  }

  try {
    // Convert File to Uint8Array for Vercel AI SDK
    const arrayBuffer = await file.arrayBuffer();
    const audio = new Uint8Array(arrayBuffer);

    const result = await transcribe({
      model: openai.transcription('whisper-1'),
      audio,
    });

    return NextResponse.json({ transcript: result.text });
  } catch (e) {
    console.error('Transcription error:', e);
    return NextResponse.json({ error: "Transcription failed" }, { status: 500 });
  }
}
