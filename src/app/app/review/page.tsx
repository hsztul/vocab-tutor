"use client";

import * as React from "react";
import { Flashcard } from "react-quizlet-flashcard";
import "react-quizlet-flashcard/dist/index.css";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { posLabel } from "@/lib/pos";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

type Sense = {
  id: string;
  word: string;
  pos: string;
  definition: string;
  example?: string | null;
  ordinal: number;
  totalSensesForWord: number;
};

export default function ReviewPage() {
  const [senses, setSenses] = React.useState<Sense[]>([]);
  const [index, setIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch senses from backend (review mode)
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/senses?mode=review&limit=50`, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load senses (${res.status})`);
        const data = await res.json();
        if (!cancelled) {
          setSenses(data.items ?? []);
          setIndex(0);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = senses[index] ?? null;
  const [queuedMap, setQueuedMap] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    // Initialize queued map from API result if provided
    const map: Record<string, boolean> = {};
    for (const s of senses) {
      // @ts-ignore queued may exist from API
      if (typeof (s as any).queued === "boolean") map[s.id] = (s as any).queued;
    }
    setQueuedMap(map);
  }, [senses]);

  const toggleQueue = async () => {
    if (!current) return;
    const nextQueued = !queuedMap[current.id];
    setQueuedMap((m) => ({ ...m, [current.id]: nextQueued }));
    try {
      const res = await fetch(`/api/progress/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ senseId: current.id, queued: nextQueued }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(nextQueued ? "Queued for Test" : "Removed from Test queue", {
        description: `${current.word} (${posLabel(current.pos)})`,
        duration: 1500,
      });
    } catch (e: any) {
      setQueuedMap((m) => ({ ...m, [current.id]: !nextQueued }));
      toast.error("Could not update queue", { description: String(e?.message || ""), duration: 2000 });
    }
  };

  const goPrev = () => {
    setIndex((i) => (i - 1 + senses.length) % senses.length);
  };
  const goNext = () => {
    setIndex((i) => (i + 1) % senses.length);
  };

  const markAsReviewed = async () => {
    if (!current) return;
    
    void fetch(`/api/progress/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ senseId: current.id }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        toast.success("Marked as reviewed", {
          description: `${current.word} (${posLabel(current.pos)})`,
          duration: 1500,
        });
      })
      .catch(() => {
        toast.error("Could not save review", { duration: 2000 });
      });
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
      <p className="text-sm text-foreground/70">
        Sense-based flashcards. Flip to mark a sense as reviewed.
      </p>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-24" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-20" />
            </div>
          </div>
        </div>
      ) : !current ? (
        <div className="space-y-3">
          <div className="h-64 w-full rounded-lg border border-black/10 dark:border-white/10 grid place-items-center text-sm text-foreground/60">
            No senses found. Try ingesting the dataset on the Admin page.
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline">
              <a href="/app/admin">Go to Admin</a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-foreground/70">
            <div>
              Sense {current.ordinal} of {current.totalSensesForWord} for
              <span className="font-medium text-foreground"> {current.word}</span>
            </div>
            <div className="text-foreground/60">
              Card {index + 1} / {senses.length}
            </div>
          </div>

          <div className="space-y-3 flex flex-col items-center">
            <Flashcard
              front={{
                html: (
                  <div className="flex items-center justify-center h-full text-center">
                    <div className="text-lg font-medium">
                      {current.word} ({posLabel(current.pos)})
                    </div>
                  </div>
                )
              }}
              back={{
                html: (
                  <div className="p-6 space-y-3 h-full flex flex-col justify-center">
                    <div className="text-base leading-relaxed">{current.definition}</div>
                    {current.example && (
                      <div className="text-sm text-foreground/70 italic">
                        "{current.example}"
                      </div>
                    )}
                  </div>
                )
              }}
            />

            <div className="space-y-2">
              <div className="text-xs text-foreground/60 text-center">Click the card to flip</div>
              <div className="flex justify-center gap-2">
                  <Button variant="outline" onClick={goPrev} aria-label="Previous card">
                    Prev
                  </Button>
                  <Button
                    variant={queuedMap[current.id] ? "default" : "outline"}
                    onClick={toggleQueue}
                    aria-label="Toggle known"
                    className={queuedMap[current.id] ? "bg-purple-600 hover:bg-purple-700 text-white" : "border-purple-500 text-purple-600 hover:text-purple-700"}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> I know this!
                  </Button>
                  <Button onClick={goNext} aria-label="Next card">
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }
