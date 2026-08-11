import {
  useCallback,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { cn } from "@/shared/lib/utils";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface MushafLineHighlightProps {
  containerRef: RefObject<HTMLElement | null>;
  verseKey: string | null;
  activeWordLocation: string | null;
  pulse: boolean;
  enabled: boolean;
}

function measureHorizontalSpan(
  container: HTMLElement,
  selector: string,
): HighlightRect | null {
  const nodes = container.querySelectorAll<HTMLElement>(selector);
  const lineHeight = container.clientHeight;
  if (nodes.length === 0 || lineHeight <= 0) return null;

  const containerRect = container.getBoundingClientRect();
  const inset = Math.max(1, Math.round(lineHeight * 0.05));
  let leftEdge = Infinity;
  let rightEdge = -Infinity;

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    leftEdge = Math.min(leftEdge, rect.left);
    rightEdge = Math.max(rightEdge, rect.right);
  }

  if (!Number.isFinite(leftEdge)) return null;

  return {
    top: inset,
    left: Math.max(0, leftEdge - containerRect.left),
    width: Math.max(0, rightEdge - leftEdge),
    height: Math.max(0, lineHeight - inset * 2),
  };
}

function measureWord(
  container: HTMLElement,
  selector: string,
): HighlightRect | null {
  const nodes = container.querySelectorAll<HTMLElement>(selector);
  const lineHeight = container.clientHeight;
  if (nodes.length === 0 || lineHeight <= 0) return null;

  const containerRect = container.getBoundingClientRect();
  let topEdge = Infinity;
  let leftEdge = Infinity;
  let rightEdge = -Infinity;
  let bottomEdge = -Infinity;

  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    topEdge = Math.min(topEdge, rect.top);
    leftEdge = Math.min(leftEdge, rect.left);
    rightEdge = Math.max(rightEdge, rect.right);
    bottomEdge = Math.max(bottomEdge, rect.bottom);
  }

  if (!Number.isFinite(topEdge)) return null;

  const inset = Math.max(1, Math.round(lineHeight * 0.05));
  const top = Math.max(inset, topEdge - containerRect.top);
  const bottom = Math.min(lineHeight - inset, bottomEdge - containerRect.top);

  return {
    top,
    left: Math.max(0, leftEdge - containerRect.left),
    width: Math.max(0, rightEdge - leftEdge),
    height: Math.max(0, bottom - top),
  };
}

export function MushafLineHighlight({
  containerRef,
  verseKey,
  activeWordLocation,
  pulse,
  enabled,
}: MushafLineHighlightProps) {
  const [ayahRect, setAyahRect] = useState<HighlightRect | null>(null);
  const [wordRect, setWordRect] = useState<HighlightRect | null>(null);

  // ResizeObserver and event cleanup require one stable subscription callback.
  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container || !enabled) {
      setAyahRect(null);
      setWordRect(null);
      return;
    }

    setAyahRect(
      verseKey
        ? measureHorizontalSpan(
            container,
            `[data-verse-key="${CSS.escape(verseKey)}"]`,
          )
        : null,
    );
    setWordRect(
      activeWordLocation
        ? measureWord(
            container,
            `[data-location="${CSS.escape(activeWordLocation)}"]`,
          )
        : null,
    );
  }, [activeWordLocation, containerRef, enabled, verseKey]);

  useLayoutEffect(() => {
    measure();

    const container = containerRef.current;
    if (!container || !enabled) return;

    const observer = new ResizeObserver(measure);
    observer.observe(container);
    const scrollContainer = container.closest(".mushaf-stage");
    window.addEventListener("resize", measure);
    scrollContainer?.addEventListener("scroll", measure, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      scrollContainer?.removeEventListener("scroll", measure);
    };
  }, [containerRef, enabled, measure]);

  if (!ayahRect && !wordRect) return null;

  const ayahStyle: CSSProperties | undefined = ayahRect
    ? { ...ayahRect }
    : undefined;
  const wordStyle: CSSProperties | undefined = wordRect
    ? { ...wordRect }
    : undefined;

  return (
    <div className="mushaf-line__highlights" aria-hidden>
      {ayahRect ? (
        <div
          className={cn(
            "mushaf-ayah-highlight",
            pulse && "mushaf-ayah-highlight--pulse",
          )}
          style={ayahStyle}
        />
      ) : null}
      {wordRect ? (
        <div
          className="mushaf-ayah-highlight mushaf-ayah-highlight--reciting-word"
          style={wordStyle}
        />
      ) : null}
    </div>
  );
}
