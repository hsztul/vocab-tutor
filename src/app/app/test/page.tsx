"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { posLabel } from "@/lib/pos";
import { toast } from "sonner";
import { Mic, MicOff, Loader2, CheckCircle2, XCircle } from "lucide-react";

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
      
      // Show immediate feedback
      toast.success(gradeResult.pass ? "🎉 Correct!" : "📚 Keep practicing", {
        description: `${(gradeResult.score * 100).toFixed(0)}% — ${gradeResult.feedback}`,
        duration: 3000,
      });
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
          {/* Word Display */}
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-6 space-y-3 bg-gradient-to-br from-background to-muted/20">
            <div className="text-xs text-foreground/60 uppercase tracking-wide">
              Sense {sense.ordinal} of {sense.totalSensesForWord}
            </div>
            <div className="text-3xl font-bold tracking-tight">
              {sense.word}
            </div>
            <div className="text-sm text-foreground/70 font-medium">
              {posLabel(sense.pos)}
            </div>
          </div>

          {/* Recording Interface */}
          <div className="rounded-lg border border-black/10 dark:border-white/10 p-6 space-y-4">
            <div className="text-center space-y-4">
              {testState === "idle" && (
                <div className="space-y-3">
                  <div className="text-sm text-foreground/70">
                    Press start and speak the definition clearly
                  </div>
                  <Button 
                    size="lg" 
                    onClick={startRecording}
                    className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200 hover:scale-105"
                  >
                    <Mic className="h-6 w-6" />
                  </Button>
                </div>
              )}

              {isRecording && (
                <div className="space-y-3">
                  <div className="text-sm text-red-600 dark:text-red-400 font-medium animate-pulse">
                    🔴 Recording... speak your definition
                  </div>
                  <Button 
                    size="lg" 
                    onClick={stopRecording}
                    variant="destructive"
                    className="h-16 w-16 rounded-full transition-all duration-200 hover:scale-105"
                  >
                    <MicOff className="h-6 w-6" />
                  </Button>
                </div>
              )}

              {isProcessing && (
                <div className="space-y-3">
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    🔄 Transcribing audio...
                  </div>
                  <div className="h-16 w-16 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                </div>
              )}

              {isGrading && (
                <div className="space-y-3">
                  <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                    🤖 Grading your response...
                  </div>
                  <div className="h-16 w-16 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-purple-600 dark:text-purple-400 animate-spin" />
                  </div>
                </div>
              )}
            </div>

            {/* Transcript Display */}
            {transcript && (
              <div className="rounded-md bg-muted/50 p-4 space-y-2">
                <div className="text-xs text-foreground/60 uppercase tracking-wide">
                  Your Response
                </div>
                <div className="text-sm text-foreground">
                  "{transcript}"
                </div>
              </div>
            )}

            {/* Result Display */}
            {result && testState === "result" && (
              <div className={`rounded-md p-4 space-y-3 transition-all duration-300 ${
                result.pass 
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800" 
                  : "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800"
              }`}>
                <div className="flex items-center gap-2">
                  {result.pass ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  )}
                  <div className={`font-semibold ${
                    result.pass 
                      ? "text-emerald-700 dark:text-emerald-300" 
                      : "text-rose-700 dark:text-rose-300"
                  }`}>
                    {result.pass ? "Correct!" : "Keep practicing"}
                  </div>
                  <div className="text-sm text-foreground/70">
                    {(result.score * 100).toFixed(0)}%
                  </div>
                </div>
                {result.feedback && (
                  <div className="text-sm text-foreground/80 space-y-2">
                    {result.feedback.split('\n').map((line, index) => {
                      if (line.trim() === '') return null;
                      if (line.startsWith('Key Points:')) {
                        return (
                          <div key={index} className="font-medium text-foreground/90 mt-3 mb-1">
                            {line}
                          </div>
                        );
                      }
                      if (line.startsWith('•')) {
                        return (
                          <div key={index} className="text-sm text-foreground/75 ml-2">
                            {line}
                          </div>
                        );
                      }
                      return (
                        <div key={index} className="text-sm">
                          {line}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center gap-3 pt-2">
              {testState === "result" && (
                <Button onClick={loadSense} className="transition-all duration-200">
                  Next Word
                </Button>
              )}
              {testState === "idle" && transcript && (
                <Button 
                  variant="outline" 
                  onClick={() => processTranscriptAndGrade(transcript)}
                  disabled={!transcript.trim()}
                >
                  Grade Response
                </Button>
              )}
            </div>

            {error && (
              <div className="text-sm text-rose-600 dark:text-rose-400 text-center bg-rose-50 dark:bg-rose-900/20 rounded-md p-3">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
