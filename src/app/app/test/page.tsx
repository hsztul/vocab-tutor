"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TestFlashcard } from "@/components/test-flashcard";
import { toast } from "sonner";

type Sense = {
  id: string;
  word: string;
  pos: string;
  definition: string;
  example?: string | null;
  ordinal: number;
  totalSensesForWord: number;
};

type TestState = "idle" | "recording" | "processing" | "grading" | "result";

export default function TestPage() {
  const [sense, setSense] = React.useState<Sense | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [transcript, setTranscript] = React.useState("");
  const [result, setResult] = React.useState<{ pass: boolean; score: number; feedback: string } | null>(null);
  const [testState, setTestState] = React.useState<TestState>("idle");
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);

  async function loadSense() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      setTranscript("");
      setTestState("idle");
      const res = await fetch("/api/words?mode=test&limit=1", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setSense(data.items?.[0] ?? null);
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadSense();
  }, []);

  async function processTranscriptAndGrade(audioTranscript: string) {
    if (!sense || !audioTranscript.trim()) return;
    
    setTestState("grading");
    setTranscript(audioTranscript);
    
    try {
      const res = await fetch("/api/test/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wordId: sense.id, transcript: audioTranscript, durationMs: null }),
      });
      if (!res.ok) throw new Error(`Grading failed (${res.status})`);
      const data = await res.json();
      
      const gradeResult = { 
        pass: !!data.pass, 
        score: Number(data.score ?? 0), 
        feedback: String(data.feedback ?? "") 
      };
      
      setResult(gradeResult);
      setTestState("result");
    } catch (e: any) {
      setError(e?.message || "Grading failed");
      setTestState("idle");
      toast.error("Grading failed", { description: String(e?.message || ""), duration: 2000 });
    }
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Microphone not supported in this browser");
      return;
    }
    
    setTestState("recording");
    setError(null);
    setResult(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      
      mr.onstop = async () => {
        setTestState("processing");
        const blob = new Blob(chunksRef.current, { type: mime });
        
        try {
          const fd = new FormData();
          const filename = mime.includes("webm") ? "audio.webm" : "audio.mp4";
          const file = new File([blob], filename, { type: mime });
          fd.append("file", file);
          
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          if (res.status === 501) {
            toast.error("Transcription not configured", { description: "Set OPENAI_API_KEY to enable Whisper" });
            setTestState("idle");
            return;
          }
          if (!res.ok) throw new Error(`Transcription failed (${res.status})`);
          
          const data = await res.json();
          if (typeof data?.transcript === "string" && data.transcript.trim()) {
            // Automatically process transcript and grade
            await processTranscriptAndGrade(data.transcript.trim());
          } else {
            toast.error("No transcript returned");
            setTestState("idle");
          }
        } catch (e: any) {
          toast.error("Transcription failed", { description: String(e?.message || ""), duration: 2000 });
          setTestState("idle");
        } finally {
          // stop all tracks
          stream.getTracks().forEach((t) => t.stop());
        }
      };
      
      mediaRecorderRef.current = mr;
      mr.start();
      toast("🎤 Recording started", { duration: 1000 });
    } catch (e: any) {
      toast.error("Mic permission denied", { description: String(e?.message || "") });
      setTestState("idle");
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") {
      mr.stop();
      toast("🔄 Processing audio...", { duration: 800 });
    }
  }

  const isRecording = testState === "recording";
  const isProcessing = testState === "processing";
  const isGrading = testState === "grading";
  const isDisabled = isProcessing || isGrading;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Test Mode</h1>
        <p className="text-sm text-foreground/70">
          Hit start to record your definition, then we'll automatically transcribe and grade it.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !sense ? (
        <div className="rounded-lg border border-black/10 dark:border-white/10 p-8 text-center space-y-3">
          <div className="text-sm text-foreground/70">
            No items pending in Test mode. Try reviewing more senses first.
          </div>
          <Button asChild variant="outline">
            <a href="/app/review">Go to Review</a>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <TestFlashcard
              word={sense.word}
              pos={sense.pos}
              ordinal={sense.ordinal}
              totalSenses={sense.totalSensesForWord}
              testState={testState}
              transcript={transcript}
              result={result}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              className="w-full max-w-2xl"
            />

            {/* Action Buttons */}
            {testState === "result" && (
              <Button onClick={loadSense} className="transition-all duration-200">
                Next Word
              </Button>
            )}

            {error && (
              <div className="text-sm text-rose-600 dark:text-rose-400 text-center bg-rose-50 dark:bg-rose-900/20 rounded-md p-3 max-w-md">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
