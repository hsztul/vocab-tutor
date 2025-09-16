import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Dictionary API response types
interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
}

interface DictionaryPhonetic {
  text: string;
  audio?: string;
}

interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: DictionaryPhonetic[];
  origin?: string;
  meanings: DictionaryMeaning[];
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ word: string }> }
) {
  const { word } = await params;
  
  if (!word) {
    return NextResponse.json({ error: "Word parameter is required" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      {
        headers: {
          'User-Agent': 'VocabTutor/1.0',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Word not found" }, { status: 404 });
      }
      throw new Error(`Dictionary API returned ${response.status}`);
    }

    const data: DictionaryEntry[] = await response.json();
    
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No definitions found" }, { status: 404 });
    }

    // Transform the data to a more usable format
    const entry = data[0];
    const result = {
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics[0]?.text || "",
      audio: entry.phonetics.find(p => p.audio)?.audio || "",
      origin: entry.origin || "",
      meanings: entry.meanings.map(meaning => ({
        partOfSpeech: meaning.partOfSpeech,
        definitions: meaning.definitions.map(def => ({
          definition: def.definition,
          example: def.example || "",
          synonyms: def.synonyms || [],
          antonyms: def.antonyms || []
        }))
      }))
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Dictionary API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch word definition" },
      { status: 500 }
    );
  }
}
