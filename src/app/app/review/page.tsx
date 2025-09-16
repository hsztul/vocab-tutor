"use client";

import * as React from "react";
import { Flashcard } from "@/components/flashcard";
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

type Word = {
  id: string;
  word: string;
  queued: boolean;
};

export default function ReviewPage() {
  const [words, setWords] = React.useState<Word[]>([]);
  const [index, setIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isLandscape, setIsLandscape] = React.useState(false);
  const [cardFlipped, setCardFlipped] = React.useState(false);

  // Detect mobile landscape orientation
  React.useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 1024; // Only consider mobile/tablet sizes
      const isLandscapeOrientation = window.innerHeight < window.innerWidth;
      setIsLandscape(isMobile && isLandscapeOrientation);
    };
    
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);


  // Fetch words from backend (review mode)
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/words?mode=review&limit=1000`, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load words (${res.status})`);
        const data = await res.json();
        if (!cancelled) {
          setWords(data.items ?? []);
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

  const current = words[index] ?? null;
  const hasNext = index < words.length - 1;
  const hasPrev = index > 0;
  const [queuedMap, setQueuedMap] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!current) return;
    setQueuedMap((m) => ({ ...m, [current.id]: current.queued }));
  }, [current]);

  React.useEffect(() => {
    // Initialize queued map from API result if provided
    const map: Record<string, boolean> = {};
    for (const s of words) {
      // @ts-ignore queued may exist from API
      if (typeof (s as any).queued === "boolean") map[s.id] = (s as any).queued;
    }
    setQueuedMap(map);
  }, [words]);

  const toggleQueue = async () => {
    if (!current) return;
    const nextQueued = !queuedMap[current.id];
    setQueuedMap((m) => ({ ...m, [current.id]: nextQueued }));
    try {
      const res = await fetch(`/api/progress/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ wordId: current.id, queued: nextQueued }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(nextQueued ? "Queued for Test" : "Removed from Test queue", {
        description: current.word,
        duration: 1500,
      });
    } catch (e: any) {
      setQueuedMap((m) => ({ ...m, [current.id]: !nextQueued }));
      toast.error("Could not update queue", { description: String(e?.message || ""), duration: 2000 });
    }
  };

  const goPrev = () => {
    setIndex((i) => (i - 1 + words.length) % words.length);
    setCardFlipped(false); // Reset flip state when changing cards
  };

  const goNext = () => {
    setIndex((i) => (i + 1) % words.length);
    setCardFlipped(false); // Reset flip state when changing cards
  };

  const flipCard = () => {
    setCardFlipped(!cardFlipped);
  };

  const markAsReviewed = async () => {
    if (!current) return;
    
    void fetch(`/api/progress/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ wordId: current.id }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        toast.success("Marked as reviewed", {
          description: current.word,
          duration: 1500,
        });
      })
      .catch(() => {
        toast.error("Could not save review", { duration: 2000 });
      });
  };

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keys when not typing in an input/textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          if (hasPrev) goPrev();
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (hasNext) goNext();
          break;
        case ' ':
        case 'Space':
          event.preventDefault();
          flipCard();
          break;
        case 'Enter':
          event.preventDefault();
          if (current) toggleQueue();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, goPrev, goNext, current, toggleQueue, flipCard]);

  // Landscape mode: simplified layout with full-screen card
  if (isLandscape) {
    return (
      <div className="h-screen">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : !current ? (
          <div className="h-full w-full rounded-lg border border-black/10 dark:border-white/10 grid place-items-center text-sm text-foreground/60">
            No words found. Try ingesting the dataset on the Admin page.
          </div>
        ) : (
          <Flashcard
            word={current.word}
            className="h-full"
            flipped={cardFlipped}
            onFlip={setCardFlipped}
            onNext={goNext}
            onPrev={goPrev}
            onToggleKnown={toggleQueue}
            isKnown={queuedMap[current.id]}
            cardCount={`${index + 1} / ${words.length}`}
          />
        )}
      </div>
    );
  }

  // Portrait mode: original layout
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
            No words found. Try ingesting the dataset on the Admin page.
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button asChild variant="outline">
              <a href="/app/admin">Go to Admin</a>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center text-sm text-foreground/60">
            Word {index + 1} / {words.length}
          </div>

          <div className="space-y-3 flex flex-col items-center">
            <Flashcard
              word={current.word}
              className="w-full max-w-md"
              flipped={cardFlipped}
              onFlip={setCardFlipped}
              isKnown={queuedMap[current.id]}
              onNext={goNext}
              onPrev={goPrev}
              onToggleKnown={toggleQueue}
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
