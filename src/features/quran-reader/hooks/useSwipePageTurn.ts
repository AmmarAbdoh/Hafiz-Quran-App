import { useEffect, type RefObject } from "react";

const SWIPE_THRESHOLD_PX = 72;

interface UseSwipePageTurnOptions {
  enabled: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onNext: () => void;
  onPrevious: () => void;
}

export function useSwipePageTurn({
  enabled,
  containerRef,
  onNext,
  onPrevious,
}: UseSwipePageTurnOptions) {
  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container) return;

    let startX = 0;
    let startY = 0;

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      // Mushaf page numbers increase toward the left in every UI language.
      if (deltaX < 0) onNext();
      else onPrevious();
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [containerRef, enabled, onNext, onPrevious]);
}
