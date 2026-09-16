import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

interface UseListNavigationOptions {
  /** How many options are currently listed. */
  count: number;
  /** Called with the active index when Enter is pressed on one. */
  onSelect: (index: number) => void;
  /** Called on Escape, when the list has somewhere to dismiss to. */
  onDismiss?: () => void;
  /**
   * Changes when the list's contents change, so the active option returns to
   * the top rather than pointing at whatever now sits at the old index.
   */
  resetKey?: unknown;
}

/**
 * Arrow keys, Home, End, Enter and Escape over a listbox.
 *
 * Three searchable lists had written this out themselves - the shared select,
 * the quiz's ayah search and the reader's ayah search - and they had drifted:
 * two wrapped at the ends and one did not, one supported Home and End and the
 * others did not. The lists look nothing alike, so this is a hook rather than
 * a component: what they share is how the keyboard moves through them.
 */
export function useListNavigation({
  count,
  onSelect,
  onDismiss,
  resetKey,
}: UseListNavigationOptions) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [resetKey]);

  // An option can be removed by filtering while it is the active one.
  const safeIndex = count === 0 ? 0 : Math.min(activeIndex, count - 1);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      if (event.key === "Escape" && onDismiss) {
        event.preventDefault();
        onDismiss();
        return;
      }

      if (count === 0) return;

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setActiveIndex((current) => (current + 1) % count);
          return;
        case "ArrowUp":
          event.preventDefault();
          setActiveIndex((current) => (current - 1 + count) % count);
          return;
        case "Home":
          event.preventDefault();
          setActiveIndex(0);
          return;
        case "End":
          event.preventDefault();
          setActiveIndex(count - 1);
          return;
        case "Enter":
          event.preventDefault();
          onSelect(safeIndex);
          return;
        default:
      }
    },
    [count, onDismiss, onSelect, safeIndex],
  );

  return { activeIndex: safeIndex, setActiveIndex, onKeyDown };
}
