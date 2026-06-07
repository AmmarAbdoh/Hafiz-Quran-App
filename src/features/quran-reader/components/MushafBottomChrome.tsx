import { useEffect, useRef, type ReactNode } from "react";
import { useAutoHideDock } from "@/features/quran-reader/hooks/useAutoHideDock";
import { cn } from "@/shared/lib/utils";

const DEFAULT_PEEK_PX = 10;
/** Minimum scroll reserve so content clears the footer even when hidden. */
const MIN_DOCK_RESERVE_PX = 52;
const DOCK_SCROLL_EXTRA_PX = 12;

interface MushafBottomChromeProps {
  children: ReactNode;
  layoutRef: React.RefObject<HTMLElement | null>;
  /** When 0, the dock hides fully when collapsed (surah layout). */
  collapsePeekPx?: number;
  pinned?: boolean;
}

export function MushafBottomChrome({
  children,
  layoutRef,
  collapsePeekPx = DEFAULT_PEEK_PX,
  pinned = false,
}: MushafBottomChromeProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const {
    expanded,
    handleMouseEnter,
    handleMouseLeave,
    handleFocusCapture,
    handleBlurCapture,
    handleFocus,
  } = useAutoHideDock({ pinned });

  useEffect(() => {
    const dock = dockRef.current;
    const chrome = chromeRef.current;
    const layout = layoutRef.current;
    if (!dock || !layout) return;

    const syncOffset = () => {
      const visibleOffset = expanded ? dock.offsetHeight : collapsePeekPx;
      const chromeHeight = chrome?.offsetHeight ?? dock.offsetHeight;
      const reserve = Math.max(chromeHeight, MIN_DOCK_RESERVE_PX) + DOCK_SCROLL_EXTRA_PX;

      layout.style.setProperty("--mushaf-dock-offset", `${visibleOffset}px`);
      layout.style.setProperty("--mushaf-dock-reserve", `${reserve}px`);
    };

    syncOffset();
    const observer = new ResizeObserver(syncOffset);
    observer.observe(dock);
    if (chrome) observer.observe(chrome);

    return () => observer.disconnect();
  }, [collapsePeekPx, expanded, layoutRef, children, pinned]);

  const fullyCollapsed = !pinned && !expanded && collapsePeekPx === 0;
  const peekCollapsed = !pinned && !expanded && collapsePeekPx > 0;

  return (
    <>
      {fullyCollapsed && (
        <div
          className="mushaf-bottom-dock__hover-sentinel"
          aria-hidden
          onMouseEnter={handleMouseEnter}
        />
      )}
      <div
        ref={dockRef}
        className={cn(
          "mushaf-bottom-dock",
          peekCollapsed && "mushaf-bottom-dock--collapsed",
          fullyCollapsed && "mushaf-bottom-dock--fully-collapsed",
          pinned && "mushaf-bottom-dock--pinned",
        )}
        onMouseEnter={!pinned ? handleMouseEnter : undefined}
        onMouseLeave={!pinned ? handleMouseLeave : undefined}
        onFocusCapture={handleFocusCapture}
        onBlurCapture={handleBlurCapture}
        onFocus={handleFocus}
      >
        <div ref={chromeRef} className="mushaf-bottom-chrome">{children}</div>
        {!pinned && collapsePeekPx > 0 && peekCollapsed && (
          <div className="mushaf-bottom-dock__peek" aria-hidden />
        )}
      </div>
    </>
  );
}
