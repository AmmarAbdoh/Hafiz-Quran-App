import { useCallback, useLayoutEffect, useState, type RefObject } from "react";
import { cn } from "@/shared/lib/utils";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface MushafLineAyahHighlightProps {
  containerRef: RefObject<HTMLElement | null>;
  verseKey: string | null;
  recitationWordLocation: string | null;
  pulse: boolean;
  enabled: boolean;
}

/** Horizontal span of matched nodes, clamped to the line box height. */
function measureLineAyahRect(
  container: HTMLElement,
  selector: string,
): HighlightRect | null {
  const nodes = container.querySelectorAll<HTMLElement>(selector);
  if (nodes.length === 0) return null;

  const containerRect = container.getBoundingClientRect();
  const lineHeight = container.clientHeight;
  if (lineHeight <= 0) return null;

  // ~5% vertical inset keeps adjacent line highlights from touching.
  const insetY = Math.max(1, Math.round(lineHeight * 0.05));

  let minLeft = Infinity;
  let maxRight = -Infinity;

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    minLeft = Math.min(minLeft, rect.left);
    maxRight = Math.max(maxRight, rect.right);
  }

  if (!Number.isFinite(minLeft)) return null;

  const left = Math.max(0, minLeft - containerRect.left);
  const width = Math.max(0, maxRight - minLeft);

  return {
    top: insetY,
    left,
    width,
    height: Math.max(0, lineHeight - insetY * 2),
  };
}

/** Tighter rect for a single reciting word, still clamped inside the line. */
function measureWordRect(
  container: HTMLElement,
  selector: string,
): HighlightRect | null {
  const nodes = container.querySelectorAll<HTMLElement>(selector);
  if (nodes.length === 0) return null;

  const containerRect = container.getBoundingClientRect();
  const lineHeight = container.clientHeight;
  if (lineHeight <= 0) return null;

  let minTop = Infinity;
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let maxBottom = -Infinity;

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    minTop = Math.min(minTop, rect.top);
    minLeft = Math.min(minLeft, rect.left);
    maxRight = Math.max(maxRight, rect.right);
    maxBottom = Math.max(maxBottom, rect.bottom);
  }

  if (!Number.isFinite(minTop)) return null;

  const insetY = Math.max(1, Math.round(lineHeight * 0.05));
  const top = Math.max(insetY, minTop - containerRect.top);
  const bottom = Math.min(lineHeight - insetY, maxBottom - containerRect.top);

  return {
    top,
    left: Math.max(0, minLeft - containerRect.left),
    width: Math.max(0, maxRight - minLeft),
    height: Math.max(0, bottom - top),
  };
}

export function MushafLineAyahHighlight({
  containerRef,
  verseKey,
  recitationWordLocation,
  pulse,
  enabled,
}: MushafLineAyahHighlightProps) {
  const [ayahRect, setAyahRect] = useState<HighlightRect | null>(null);
  const [recitingRect, setRecitingRect] = useState<HighlightRect | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || !enabled) {
      setAyahRect(null);
      setRecitingRect(null);
      return;
    }

    setAyahRect(
      verseKey
        ? measureLineAyahRect(
            container,
            `[data-verse-key="${CSS.escape(verseKey)}"]`,
          )
        : null,
    );

    setRecitingRect(
      recitationWordLocation
        ? measureWordRect(
            container,
            `[data-location="${CSS.escape(recitationWordLocation)}"]`,
          )
        : null,
    );
  }, [containerRef, enabled, recitationWordLocation, verseKey]);

  useLayoutEffect(() => {
    measure();

    const container = containerRef.current;
    if (!container || !enabled) return;

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    const stage = container.closest(".mushaf-stage");
    window.addEventListener("resize", measure);
    stage?.addEventListener("scroll", measure, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      stage?.removeEventListener("scroll", measure);
    };
  }, [containerRef, enabled, measure]);

  if (!ayahRect && !recitingRect) return null;

  const rectStyle = (rect: HighlightRect) => ({
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  });

  return (
    <div className="mushaf-line__highlights" aria-hidden>
      {ayahRect ? (
        <div
          className={cn(
            "mushaf-ayah-highlight",
            pulse && "mushaf-ayah-highlight--pulse",
          )}
          style={rectStyle(ayahRect)}
        />
      ) : null}
      {recitingRect ? (
        <div
          className="mushaf-ayah-highlight mushaf-ayah-highlight--reciting-word"
          style={rectStyle(recitingRect)}
        />
      ) : null}
    </div>
  );
}
