"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { posLabel } from "@/lib/pos";

type TestState = "idle" | "recording" | "processing" | "grading" | "result";

type TestFlashcardProps = {
  word: string;
  pos: string;
  ordinal: number;
  totalSenses: number;
  testState: TestState;
  transcript?: string;
  result?: {
    pass: boolean;
    score: number;
    feedback: string;
  } | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  className?: string;
};

export function TestFlashcard({
  word,
  pos,
  ordinal,
  totalSenses,
  testState,
  transcript,
  result,
  onStartRecording,
  onStopRecording,
  className = "",
}: TestFlashcardProps) {
  const [flipped, setFlipped] = React.useState(false);

  // Auto-flip when we get transcription
  React.useEffect(() => {
    if (transcript && !flipped) {
      setFlipped(true);
    }
  }, [transcript, flipped]);

  // Reset flip state when starting a new test
  React.useEffect(() => {
    if (testState === "idle" && !transcript) {
      setFlipped(false);
    }
  }, [testState, transcript]);

  const isRecording = testState === "recording";
  const isProcessing = testState === "processing";
  const isGrading = testState === "grading";

  return (
    <div className={`mx-auto max-w-[90vw] max-h-[90vh] w-[90vw] aspect-[4/3] [perspective:1000px] ${className}`}>
      <div
        className="relative h-full w-full transition-transform duration-300 [transform-style:preserve-3d]"
        style={{
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front - Word and Record Button */}
        <Card className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center [backface-visibility:hidden]">
          <div className="space-y-4 w-full">
            <div className="space-y-2">
              <div className="text-xs text-foreground/60 uppercase tracking-wide">
                Sense {ordinal} of {totalSenses}
              </div>
              <div className="text-3xl font-bold tracking-tight">
                {word}
              </div>
              <div className="text-sm text-foreground/70 font-medium">
                {posLabel(pos)}
              </div>
            </div>

            <div className="flex flex-col items-center space-y-3">
              {testState === "idle" && (
                <>
                  <div className="text-sm text-foreground/70">
                    Press start and speak the definition clearly
                  </div>
                  <Button 
                    size="lg" 
                    onClick={onStartRecording}
                    className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200 hover:scale-105"
                  >
                    <Mic className="h-6 w-6" />
                  </Button>
                </>
              )}

              {isRecording && (
                <>
                  <div className="text-sm text-red-600 dark:text-red-400 font-medium animate-pulse">
                    🔴 Recording... speak your definition
                  </div>
                  <Button 
                    size="lg" 
                    onClick={onStopRecording}
                    variant="destructive"
                    className="h-16 w-16 rounded-full transition-all duration-200 hover:scale-105"
                  >
                    <MicOff className="h-6 w-6" />
                  </Button>
                </>
              )}

              {isProcessing && (
                <>
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    🔄 Transcribing audio...
                  </div>
                  <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                </>
              )}

              {isGrading && (
                <>
                  <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                    🤖 Grading your response...
                  </div>
                  <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 text-purple-600 dark:text-purple-400 animate-spin" />
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Back - Transcription and Results */}
        <Card
          className="absolute inset-0 rotate-y-180 p-6 [backface-visibility:hidden] flex flex-col"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="space-y-4 overflow-y-auto flex-1">
            {/* Transcript Display */}
            {transcript && (
              <div className="space-y-2">
                <div className="text-xs text-foreground/60 uppercase tracking-wide">
                  Your Response
                </div>
                <div className="text-sm text-foreground bg-muted/50 rounded-md p-3">
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
                  <div className="text-sm text-foreground/80 space-y-2 max-h-40 overflow-y-auto">
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

            {/* Loading states on back */}
            {isGrading && transcript && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-3">
                  <div className="h-8 w-8 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-spin" />
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                    Grading your response...
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          .duration-300 { transition-duration: 0ms; }
        }
      `}</style>
    </div>
  );
}
