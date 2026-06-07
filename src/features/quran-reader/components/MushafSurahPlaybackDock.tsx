import { useEffect, useRef, type ReactNode } from "react";

interface MushafSurahPlaybackDockProps {
  layoutRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
}

export function MushafSurahPlaybackDock({
  layoutRef,
  children,
}: MushafSurahPlaybackDockProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const layout = layoutRef.current;
    if (!bar || !layout) return;

    const syncOffset = () => {
      layout.style.setProperty(
        "--mushaf-audio-offset",
        `${bar.offsetHeight}px`,
      );
    };

    syncOffset();
    const observer = new ResizeObserver(syncOffset);
    observer.observe(bar);

    return () => {
      observer.disconnect();
      layout.style.setProperty("--mushaf-audio-offset", "0px");
    };
  }, [layoutRef, children]);

  return (
    <div ref={barRef} className="mushaf-playback-dock">
      {children}
    </div>
  );
}
