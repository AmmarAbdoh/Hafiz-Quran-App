import { useCallback, useEffect, useRef, useState } from "react";
import type { MushafVerse } from "@/domain/quran";
import type { QuranRouteContext } from "@/features/quran-reader/model/quranReaderRoutes";
import { findMushafVerse } from "@/domain/quran";

const HIGHLIGHT_DURATION_MS = 3_500;
const HIGHLIGHT_READY_DELAY_MS = 200;

interface UseVerseHighlightOptions {
  loading: boolean;
  mushafData: MushafVerse[];
  routeContext: QuranRouteContext;
  locationKey: string;
}

export function useVerseHighlight({
  loading,
  mushafData,
  routeContext,
  locationKey,
}: UseVerseHighlightOptions) {
  const [highlightVerseKey, setHighlightVerseKey] = useState<string | null>(
    null,
  );
  const clearTimerRef = useRef<number | null>(null);
  const pendingVerseKeyRef = useRef<string | null>(null);

  const clearHighlight = useCallback(() => {
    if (clearTimerRef.current) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setHighlightVerseKey(null);
  }, []);

  const flashHighlight = useCallback(
    (verseKey: string) => {
      clearHighlight();
      setHighlightVerseKey(verseKey);
      clearTimerRef.current = window.setTimeout(() => {
        setHighlightVerseKey(null);
        clearTimerRef.current = null;
      }, HIGHLIGHT_DURATION_MS);
    },
    [clearHighlight],
  );

  const queueHighlight = (verseKey: string) => {
    pendingVerseKeyRef.current = verseKey;
  };

  const routeVerseKey =
    routeContext.type === "ayah"
      ? `${routeContext.surah}:${routeContext.ayah}`
      : null;

  useEffect(() => {
    if (loading || mushafData.length === 0) return;

    let verseKey = routeVerseKey;
    if (routeVerseKey) {
      pendingVerseKeyRef.current = null;
    } else if (pendingVerseKeyRef.current) {
      verseKey = pendingVerseKeyRef.current;
      pendingVerseKeyRef.current = null;
    }
    if (!verseKey) return;

    const [surahPart, ayahPart] = verseKey.split(":");
    const surah = Number.parseInt(surahPart ?? "", 10);
    const ayah = Number.parseInt(ayahPart ?? "", 10);
    if (!findMushafVerse(mushafData, surah, ayah)) return;

    const timer = window.setTimeout(() => {
      flashHighlight(verseKey);
    }, HIGHLIGHT_READY_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [flashHighlight, loading, locationKey, mushafData, routeVerseKey]);

  useEffect(() => clearHighlight, [clearHighlight]);

  return { highlightVerseKey, clearHighlight, queueHighlight };
}
