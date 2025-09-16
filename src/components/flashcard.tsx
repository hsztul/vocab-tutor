"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";

type FlashcardProps = {
  frontTitle: string; // e.g., "compound (verb)"
  backDefinition: string;
  backExample?: string | null;
  className?: string;
  flipped?: boolean;
  onFlip?: (flipped: boolean) => void;
};

export function Flashcard({
  frontTitle,
  backDefinition,
  backExample,
  className = "",
  flipped: flippedProp,
  onFlip,
}: FlashcardProps) {
  const [internalFlipped, setInternalFlipped] = React.useState(false);
  const isControlled = flippedProp !== undefined;
  const flipped = isControlled ? !!flippedProp : internalFlipped;

  const handleToggle = () => {
    const next = !flipped;
    if (!isControlled) setInternalFlipped(next);
    onFlip?.(next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`w-full aspect-[3/2] [perspective:1000px] ${className}`}
      aria-label={flipped ? "Show front of card" : "Flip card to see definition"}
    >
      <div
        className="relative h-full w-full transition-transform duration-200 [transform-style:preserve-3d]"
        style={{
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front */}
        <Card
          className="absolute inset-0 flex items-center justify-center p-6 text-center text-lg font-medium [backface-visibility:hidden]"
        >
          <span>{frontTitle}</span>
        </Card>
        {/* Back */}
        <Card
          className="absolute inset-0 rotate-y-180 p-6 [backface-visibility:hidden]"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="space-y-2">
            <div className="text-base leading-relaxed">{backDefinition}</div>
            {backExample ? (
              <div className="text-sm text-foreground/70">{backExample}</div>
            ) : null}
          </div>
        </Card>
      </div>
      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          .duration-200 { transition-duration: 0ms; }
        }
      `}</style>
    </button>
  );
}
