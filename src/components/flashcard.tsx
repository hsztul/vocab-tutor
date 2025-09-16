"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { useDictionary, getPrimaryDefinition, getFormattedDefinitions } from "@/hooks/useDictionary";
import { CheckCircle2 } from "lucide-react";

type FlashcardProps = {
  word: string; // The word to look up
  className?: string;
  flipped?: boolean;
  onFlip?: (flipped: boolean) => void;
  onDictionaryLoad?: (data: any) => void; // Callback when dictionary data is loaded
  onNext?: () => void; // For swipe navigation
  onPrev?: () => void; // For swipe navigation
  onToggleKnown?: () => void; // For double-tap to toggle known
  isKnown?: boolean; // To show the indicator
  cardCount?: string; // Card count display for landscape mode
};

export function Flashcard({
  word,
  className = "",
  flipped: flippedProp,
  onFlip,
  onDictionaryLoad,
  onNext,
  onPrev,
  onToggleKnown,
  isKnown = false,
  cardCount,
}: FlashcardProps) {
  const [internalFlipped, setInternalFlipped] = React.useState(false);
  const [isLandscape, setIsLandscape] = React.useState(false);
  const isControlled = flippedProp !== undefined;
  const flipped = isControlled ? !!flippedProp : internalFlipped;
  
  // Touch handling for swipe and double-tap
  const touchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = React.useRef<number>(0);
  
  // Fetch dictionary data for the word
  const { data: dictionaryData, loading, error } = useDictionary(word);
  
  // Notify parent when dictionary data is loaded
  React.useEffect(() => {
    if (dictionaryData && onDictionaryLoad) {
      onDictionaryLoad(dictionaryData);
    }
  }, [dictionaryData, onDictionaryLoad]);

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

  const handleToggle = () => {
    const next = !flipped;
    if (!isControlled) setInternalFlipped(next);
    onFlip?.(next);
  };

  // Touch event handlers for swipe and double-tap
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !isLandscape) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check for double-tap (quick successive taps in same location)
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (distance < 30 && deltaTime < 300 && timeSinceLastTap < 500) {
      // Double-tap detected
      onToggleKnown?.();
      lastTapRef.current = 0; // Reset to prevent triple-tap
      return;
    }
    
    lastTapRef.current = now;

    // Check for swipe (horizontal movement > 50px, completed within 300ms)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 100 && deltaTime < 300) {
      if (deltaX > 0) {
        onPrev?.(); // Swipe right = previous
      } else {
        onNext?.(); // Swipe left = next
      }
    } else if (distance < 30 && deltaTime < 300) {
      // Single tap - flip card
      handleToggle();
    }

    touchStartRef.current = null;
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
    <div
      className={`w-full ${isLandscape ? 'h-full' : 'aspect-[3/2]'} [perspective:1000px] ${className} relative`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={isLandscape ? undefined : handleToggle}
      data-flashcard
    >
      {/* Card count in landscape mode */}
      {cardCount && isLandscape && (
        <div className="absolute top-3 right-3 z-10 bg-black/20 backdrop-blur-sm text-white rounded-full px-3 py-1 text-sm font-medium">
          {cardCount}
        </div>
      )}
      
      {/* "I know this" indicator */}
      {isKnown && (
        <div className={`absolute top-3 z-10 bg-purple-600 text-white rounded-full p-1.5 shadow-lg ${cardCount && isLandscape ? 'left-3' : 'right-3'}`}>
          <CheckCircle2 className="h-4 w-4" />
        </div>
      )}
      
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
          className="absolute inset-0 rotate-y-180 p-6 [backface-visibility:hidden] flex flex-col"
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className={`${isLandscape ? 'overflow-y-auto flex-1' : 'space-y-2 overflow-y-auto'} ${isLandscape ? 'max-h-full' : 'max-h-64'}`}>
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
    </div>
  );
}
