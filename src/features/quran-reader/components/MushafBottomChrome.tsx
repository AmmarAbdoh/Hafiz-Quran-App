import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** Minimum scroll reserve so the last mushaf line clears the bar. */
const MIN_DOCK_RESERVE_PX = 52;
const DOCK_SCROLL_EXTRA_PX = 12;

interface MushafBottomChromeProps {
  children: ReactNode;
  layoutRef: React.RefObject<HTMLElement | null>;
  chromeClassName?: string;
}

export function MushafBottomChrome({
  children,
  layoutRef,
  chromeClassName,
}: MushafBottomChromeProps) {
  const dockRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dock = dockRef.current;
    const chrome = chromeRef.current;
    const layout = layoutRef.current;
    if (!dock || !layout) return;

    const syncOffset = () => {
      const chromeHeight = chrome?.offsetHeight ?? dock.offsetHeight;
      const reserve =
        Math.max(chromeHeight, MIN_DOCK_RESERVE_PX) + DOCK_SCROLL_EXTRA_PX;

      layout.style.setProperty(
        "--mushaf-dock-offset",
        `${dock.offsetHeight}px`,
      );
      layout.style.setProperty("--mushaf-dock-reserve", `${reserve}px`);
    };

    syncOffset();
    const observer = new ResizeObserver(syncOffset);
    observer.observe(dock);
    if (chrome) observer.observe(chrome);

    return () => observer.disconnect();
  }, [layoutRef, children]);

  return (
    <div ref={dockRef} className="mushaf-bottom-dock">
      {/* Nothing to show means no surface at all: an empty bar would still draw
          its border and blur across the foot of the page. */}
      {children ? (
        <div
          ref={chromeRef}
          className={cn("mushaf-bottom-chrome", chromeClassName)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
