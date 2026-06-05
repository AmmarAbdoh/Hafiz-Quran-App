import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MushafLine } from "@/features/quran-reader/components/MushafLine";
import { VerseActionsPopover } from "@/features/quran-reader/components/VerseActionsPopover";
import { VerseDialog } from "@/features/quran-reader/components/VerseDialog";
import { useQcfPageFont } from "@/features/quran-reader/hooks/useQcfPageFont";
import { useQuranPlayback } from "@/features/quran-reader/context/QuranPlaybackContext";
import { useQuranAudio } from "@/features/quran-reader/hooks/useQuranAudio";
import type { VerseSelection } from "@/features/quran-reader/types/selection";
import { isCenterAlignedPage } from "@/features/quran-reader/utils/pageUtils";
import { resolveWordElementInLine } from "@/features/quran-reader/utils/mushafWordHitTest";
import { measureLineOverflowFit } from "@/features/quran-reader/utils/pageFit";
import { getWordAudioUrl } from "@/shared/constants/audio";
import { cn } from "@/shared/lib/utils";
import { useTheme } from "@/shared/hooks/use-theme";
import {
  buildFullWordLines,
  findMushafVerse,
  getWordLayoutForPage,
} from "@/shared/services/quran-data";
import type {
  MushafVerse as MushafVerseType,
  MushafWord as MushafWordType,
  MushafWordLayoutData,
} from "@/shared/types/quran";

interface MushafViewerProps {
  mushafData: MushafVerseType[];
  wordLayout: MushafWordLayoutData;
  currentPage: number;
  tajweedColored: boolean;
  highlightVerseKey?: string | null;
}

export function MushafViewer({
  mushafData,
  wordLayout,
  currentPage,
  tajweedColored,
  highlightVerseKey = null,
}: MushafViewerProps) {
  const [selection, setSelection] = useState<VerseSelection | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [playingTarget, setPlayingTarget] = useState<"word" | "ayah" | null>(
    null,
  );
  const [tafseerVerse, setTafseerVerse] = useState<MushafVerseType | null>(
    null,
  );
  const mushafRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedWordElementRef = useRef<HTMLElement | null>(null);
  const { theme } = useTheme();
  const playback = useQuranPlayback();
  const { fontFamily, fontPalette, ready: fontReady, colored } =
    useQcfPageFont(currentPage, { colored: tajweedColored, theme });
  const { play, stop, playing } = useQuranAudio();

  const pageLayout = getWordLayoutForPage(wordLayout, currentPage);
  const visibleLines = useMemo(() => {
    if (!pageLayout) return [];
    return buildFullWordLines(pageLayout).filter((line) => line.words.length > 0);
  }, [pageLayout]);

  const wordsByLocation = useMemo(() => {
    const map = new Map<string, MushafWordType>();
    for (const line of visibleLines) {
      for (const word of line.words) {
        map.set(word.location, word);
      }
    }
    return map;
  }, [visibleLines]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setAnchorRect(null);
  }, []);

  const updateAnchor = useCallback(() => {
    if (!selection || !mushafRef.current) {
      setAnchorRect(null);
      return;
    }

    const element =
      selectedWordElementRef.current ??
      mushafRef.current.querySelector(
        `[data-location="${selection.word.location}"]`,
      );
    if (element) {
      setAnchorRect(element.getBoundingClientRect());
    }
  }, [selection]);

  const getVerseForKey = useCallback(
    (verseKey: string) => {
      const [sura, aya] = verseKey.split(":").map(Number);
      return findMushafVerse(mushafData, sura!, aya!);
    },
    [mushafData],
  );

  useEffect(() => {
    clearSelection();
  }, [currentPage, clearSelection]);

  useEffect(() => {
    if (!highlightVerseKey) return;
    const word = visibleLines
      .flatMap((line) => line.words)
      .find((w) => w.verse_key === highlightVerseKey);
    if (word) {
      setSelection({ verseKey: highlightVerseKey, mode: "ayah", word });
    }
  }, [highlightVerseKey, visibleLines]);

  useEffect(() => {
    updateAnchor();
  }, [updateAnchor, fontReady, currentPage]);

  useEffect(() => {
    if (!selection) return;

    const stage = mushafRef.current?.closest(".mushaf-stage");
    const handleReposition = () => updateAnchor();

    window.addEventListener("resize", handleReposition);
    stage?.addEventListener("scroll", handleReposition, { passive: true });

    return () => {
      window.removeEventListener("resize", handleReposition);
      stage?.removeEventListener("scroll", handleReposition);
    };
  }, [selection, updateAnchor]);

  useEffect(() => {
    if (!playing) setPlayingTarget(null);
  }, [playing]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (mushafRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      clearSelection();
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [clearSelection]);

  const activateWord = useCallback(
    (fallbackWord: MushafWordType, event: React.MouseEvent<HTMLElement>) => {
      const line = event.currentTarget.closest(".mushaf-line");
      let element = event.currentTarget;
      let word = fallbackWord;

      if (line) {
        const resolved = resolveWordElementInLine(
          line as HTMLElement,
          event.clientX,
          event.clientY,
        );
        if (resolved?.dataset.location) {
          element = resolved;
          word =
            wordsByLocation.get(resolved.dataset.location) ?? fallbackWord;
        }
      }

      const isEnd = word.char_type === "end";

      setSelection((prev) => {
        if (isEnd) {
          selectedWordElementRef.current = null;
          if (prev?.mode === "ayah" && prev.verseKey === word.verse_key) {
            return null;
          }
          return { verseKey: word.verse_key, mode: "ayah", word };
        }

        if (prev?.mode === "word" && prev.word.location === word.location) {
          selectedWordElementRef.current = null;
          return null;
        }

        selectedWordElementRef.current = element;
        return { verseKey: word.verse_key, mode: "word", word };
      });
    },
    [wordsByLocation],
  );

  const handleListenWord = () => {
    if (!selection || selection.mode !== "word") return;

    playback.stop();

    const wordUrl = getWordAudioUrl(
      selection.word.sura,
      selection.word.aya,
      selection.word.word,
    );

    setPlayingTarget("word");
    void play(wordUrl);
  };

  const handleListenAyah = () => {
    if (!selection) return;

    const [sura, aya] = selection.verseKey.split(":").map(Number);
    stop();
    setPlayingTarget("ayah");
    void playback.startAyahPlayback(sura!, aya!);
  };

  const handleTafseer = () => {
    if (!selection) return;
    const verse = getVerseForKey(selection.verseKey);
    if (verse) setTafseerVerse(verse);
  };

  if (!pageLayout) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        لا توجد بيانات لهذه الصفحة.
      </p>
    );
  }

  const isSparsePage = isCenterAlignedPage(currentPage);
  const useSpreadLayout = !isSparsePage;

  useLayoutEffect(() => {
    const page = mushafRef.current;
    if (!page || !useSpreadLayout || !fontReady) return;

    const measurePageFit = () => {
      page.style.setProperty("--mushaf-page-fit", "1");

      const verses = page.querySelectorAll<HTMLElement>(".mushaf-line__verse");
      let fit = measureLineOverflowFit(verses);

      if (fit < 0.998) {
        page.style.setProperty("--mushaf-page-fit", String(fit));
        page.getBoundingClientRect();
        fit = measureLineOverflowFit(verses);
        page.style.setProperty("--mushaf-page-fit", String(fit));
      } else {
        page.style.removeProperty("--mushaf-page-fit");
      }
    };

    measurePageFit();
    const observer = new ResizeObserver(measurePageFit);
    observer.observe(page);
    return () => observer.disconnect();
  }, [currentPage, fontReady, visibleLines, useSpreadLayout, fontFamily]);

  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative mx-auto w-fit max-w-full px-2">
        {!fontReady && (
          <div className="absolute inset-0 z-10 flex min-h-[6rem] items-center justify-center text-sm text-muted-foreground">
            جاري تحميل خط الصفحة...
          </div>
        )}

        <div
          ref={mushafRef}
          className={cn(
            "mushaf-page",
            useSpreadLayout && "mushaf-page--full",
          )}
        >
          {visibleLines.map((line) => (
            <MushafLine
              key={line.line}
              lineNumber={line.line}
              words={line.words}
              spreadLayout={useSpreadLayout}
              fontFamily={fontFamily}
              fontPalette={fontPalette}
              fontReady={fontReady}
              colored={colored}
              selection={selection}
              highlightVerseKey={highlightVerseKey}
              recitationVerseKey={playback.activeVerseKey}
              recitationWordLocation={playback.activeWordLocation}
              onWordActivate={activateWord}
            />
          ))}
        </div>
      </div>

      {selection && anchorRect && (
        <VerseActionsPopover
          verseKey={selection.verseKey}
          wordLocation={selection.word.location}
          mode={selection.mode}
          anchor={anchorRect}
          playingTarget={
            playback.active && playback.playing
              ? "ayah"
              : playingTarget
          }
          onListenWord={
            selection.mode === "word" ? handleListenWord : undefined
          }
          onListenAyah={handleListenAyah}
          onTafseer={handleTafseer}
          onClose={clearSelection}
          popoverRef={popoverRef}
        />
      )}

      <VerseDialog
        verse={tafseerVerse}
        open={tafseerVerse !== null}
        onOpenChange={(open) => {
          if (!open) setTafseerVerse(null);
        }}
      />
    </div>
  );
}
