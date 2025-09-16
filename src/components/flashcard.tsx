"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { useDictionary, getPrimaryDefinition, getFormattedDefinitions } from "@/hooks/useDictionary";

type FlashcardProps = {
  word: string; // The word to look up
  className?: string;
  flipped?: boolean;
  onFlip?: (flipped: boolean) => void;
  onDictionaryLoad?: (data: any) => void; // Callback when dictionary data is loaded
};

export function Flashcard({
  word,
  className = "",
  flipped: flippedProp,
  onFlip,
  onDictionaryLoad,
}: FlashcardProps) {
  const [internalFlipped, setInternalFlipped] = React.useState(false);
  const isControlled = flippedProp !== undefined;
  const flipped = isControlled ? !!flippedProp : internalFlipped;
  
  // Fetch dictionary data for the word
  const { data: dictionaryData, loading, error } = useDictionary(word);
  
  // Notify parent when dictionary data is loaded
  React.useEffect(() => {
    if (dictionaryData && onDictionaryLoad) {
      onDictionaryLoad(dictionaryData);
    }
  }, [dictionaryData, onDictionaryLoad]);

  const handleToggle = () => {
    const next = !flipped;
    if (!isControlled) setInternalFlipped(next);
    onFlip?.(next);
  };

  // Get formatted data for display
  const primaryDefinition = getPrimaryDefinition(dictionaryData);
  const formattedDefinitions = getFormattedDefinitions(dictionaryData);
  const firstDefinition = formattedDefinitions[0];
  
  // Create front title with word and part of speech - only show part of speech if we have it
  const frontTitle = dictionaryData && firstDefinition?.partOfSpeech
    ? `${dictionaryData.word} (${firstDefinition.partOfSpeech})`
    : word;

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
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse text-sm text-foreground/70">Loading definition...</div>
              </div>
            ) : error ? (
              <div className="text-sm text-red-500">Failed to load definition: {error}</div>
            ) : dictionaryData ? (
              <>
                <div className="space-y-3">
                  {dictionaryData.meanings.map((meaning, meaningIndex) => (
                    <div key={meaningIndex} className="space-y-2">
                      <div className="text-xs font-medium text-foreground/60 uppercase tracking-wide">
                        {meaning.partOfSpeech}
                      </div>
                      <div className="space-y-2">
                        {meaning.definitions.slice(0, 2).map((def, defIndex) => (
                          <div key={defIndex} className="space-y-1">
                            <div className="text-sm leading-relaxed">
                              {meaning.definitions.length > 1 && (
                                <span className="text-foreground/50 mr-1">{defIndex + 1}.</span>
                              )}
                              {def.definition}
                            </div>
                            {def.example && (
                              <div className="text-xs text-foreground/60 italic pl-3">
                                "{def.example}"
                              </div>
                            )}
                          </div>
                        ))}
                        {meaning.definitions.length > 2 && (
                          <div className="text-xs text-foreground/50 italic">
                            +{meaning.definitions.length - 2} more definition{meaning.definitions.length > 3 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {dictionaryData.phonetic && (
                  <div className="text-xs text-foreground/50 mt-3 pt-2 border-t border-border">
                    /{dictionaryData.phonetic}/
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-foreground/70">Loading word data...</div>
            )}
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
