import { useEffect, useRef, type RefObject } from "react";

const SWIPE_THRESHOLD_PX = 72;
/** A tap is a press that stayed put; anything further is a drag or a scroll. */
const TAP_MOVE_TOLERANCE_PX = 10;
const TAP_MAX_DURATION_MS = 500;

const INTERACTIVE_SELECTOR =
  "button, a, input, textarea, [data-verse-actions], [role='dialog']";

interface UseReaderGesturesOptions {
  containerRef: RefObject<HTMLElement | null>;
  /** Page turning only applies to the paged layout, and never mid-practice. */
  swipeEnabled: boolean;
  tapEnabled: boolean;
  onTap: () => void;
  onSwipeNext: () => void;
  onSwipePrevious: () => void;
}

/**
 * One place decides what a pointer interaction on the mushaf stage meant.
 *
 * Tap and swipe used to be handled independently - swipe on touch events with
 * a 72px threshold, tap on pointerup with no threshold at all - so the two
 * disagreed constantly: a swipe too short to turn the page toggled the
 * toolbar, a swipe long enough to turn the page toggled it as well, and so
 * did every vertical scroll. Deciding once, on release, is what makes a
 * gesture mean exactly one thing.
 */
export function useReaderGestures({
  containerRef,
  swipeEnabled,
  tapEnabled,
  onTap,
  onSwipeNext,
  onSwipePrevious,
}: UseReaderGesturesOptions) {
  // Held in a ref so changing handlers never detaches a press in progress.
  const handlersRef = useRef({ onTap, onSwipeNext, onSwipePrevious });
  handlersRef.current = { onTap, onSwipeNext, onSwipePrevious };

  const optionsRef = useRef({ swipeEnabled, tapEnabled });
  optionsRef.current = { swipeEnabled, tapEnabled };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let startedOnControl = false;

    const reset = () => {
      pointerId = null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      // A second finger means a pinch or a two-finger scroll, not a page turn.
      if (pointerId !== null) {
        reset();
        return;
      }
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startedAt = event.timeStamp;
      startedOnControl = Boolean(
        (event.target as HTMLElement | null)?.closest(INTERACTIVE_SELECTOR),
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return;
      reset();

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const { swipeEnabled: canSwipe, tapEnabled: canTap } = optionsRef.current;

      // A mouse drag over the page is a text selection, not a page turn.
      const swipeable = event.pointerType !== "mouse";

      if (canSwipe && swipeable && absX >= SWIPE_THRESHOLD_PX && absX > absY) {
        // Mushaf page numbers increase toward the left in every UI language.
        if (deltaX < 0) handlersRef.current.onSwipeNext();
        else handlersRef.current.onSwipePrevious();
        return;
      }

      if (
        canTap &&
        !startedOnControl &&
        absX <= TAP_MOVE_TOLERANCE_PX &&
        absY <= TAP_MOVE_TOLERANCE_PX &&
        event.timeStamp - startedAt <= TAP_MAX_DURATION_MS
      ) {
        handlersRef.current.onTap();
      }
    };

    container.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    container.addEventListener("pointerup", handlePointerUp, { passive: true });
    container.addEventListener("pointercancel", reset, { passive: true });

    return () => {
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("pointercancel", reset);
    };
  }, [containerRef]);
}
