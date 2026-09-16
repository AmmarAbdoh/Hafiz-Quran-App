import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/shared/components/Toast";
import { useQuranPlaybackActions } from "@/features/quran-reader/context/QuranPlaybackContext";
import { useQuranPlaybackState } from "@/features/quran-reader/context/QuranPlaybackContext";
import { useQuranAudio } from "@/features/quran-reader/hooks/useQuranAudio";
import type { VerseSelection } from "@/features/quran-reader/model/selection";
import { resolveWordElementInLine } from "@/features/quran-reader/model/mushafWordHitTest";
import { useBookmarks } from "@/features/quran-reader/hooks/useBookmarks";
import {
  copyVerseText,
  shareVerseText,
} from "@/features/quran-reader/services/verseShare";
import { getWordAudioUrl } from "@/domain/quran";
import { findMushafVerse } from "@/domain/quran";
import type {
  MushafActivationEvent,
  MushafVerse as MushafVerseType,
  MushafWord as MushafWordType,
} from "@/domain/quran";

interface UseMushafVerseInteractionsOptions {
  mushafRef: RefObject<HTMLElement | null>;
  mushafData: MushafVerseType[];
  wordsByLocation: Map<string, MushafWordType>;
  highlightVerseKey?: string | null;
  resetKey?: string | number;
  scrollContainerSelector?: string;
}

export function useMushafVerseInteractions({
  mushafRef,
  mushafData,
  wordsByLocation,
  highlightVerseKey = null,
  resetKey,
  scrollContainerSelector = ".mushaf-stage",
}: UseMushafVerseInteractionsOptions) {
  const [selection, setSelection] = useState<VerseSelection | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [playingTarget, setPlayingTarget] = useState<"word" | "ayah" | null>(
    null,
  );
  const [tafseerVerse, setTafseerVerse] = useState<MushafVerseType | null>(
    null,
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedWordElementRef = useRef<HTMLElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const playback = useQuranPlaybackActions();
  const playbackState = useQuranPlaybackState();
  const { play, stop, playing } = useQuranAudio();
  const { isBookmarked, toggleBookmark, bookmarkedSet } = useBookmarks();
  const { t } = useTranslation("reader");
  const { toast } = useToast();

  const clearSelection = useCallback(() => {
    longPressTriggeredRef.current = false;
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const selectedWordElement = selectedWordElementRef.current;
    const shouldRestoreFocus = Boolean(
      popoverRef.current?.contains(document.activeElement),
    );

    setSelection(null);
    setAnchorRect(null);
    selectedWordElementRef.current = null;

    if (shouldRestoreFocus && selectedWordElement?.isConnected) {
      selectedWordElement.focus();
    }
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
  }, [selection, mushafRef]);

  const getVerseForKey = useCallback(
    (verseKey: string) => {
      const [sura, aya] = verseKey.split(":").map(Number);
      return findMushafVerse(mushafData, sura!, aya!);
    },
    [mushafData],
  );

  useEffect(() => {
    clearSelection();
  }, [resetKey, clearSelection]);

  useEffect(() => {
    if (highlightVerseKey) {
      clearSelection();
    }
  }, [highlightVerseKey, clearSelection]);

  useEffect(() => {
    updateAnchor();
  }, [updateAnchor, resetKey]);

  useEffect(() => {
    if (!selection) return;

    const stage = mushafRef.current?.closest(scrollContainerSelector);
    const handleReposition = () => updateAnchor();

    window.addEventListener("resize", handleReposition);
    stage?.addEventListener("scroll", handleReposition, { passive: true });

    return () => {
      window.removeEventListener("resize", handleReposition);
      stage?.removeEventListener("scroll", handleReposition);
    };
  }, [selection, updateAnchor, mushafRef, scrollContainerSelector]);

  useEffect(() => {
    if (!playing) setPlayingTarget(null);
  }, [playing]);

  useEffect(() => {
    if (!playbackState.active) return;
    stop();
    setPlayingTarget(null);
  }, [playbackState.active, stop]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (mushafRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      clearSelection();
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [clearSelection, mushafRef]);

  const handleCopyVerse = useCallback(async () => {
    if (!selection) return;
    const verse = getVerseForKey(selection.verseKey);
    if (!verse) return;
    await copyVerseText(verse.aya_text);
    toast(t("actions.copied"));
    clearSelection();
  }, [clearSelection, getVerseForKey, selection, t, toast]);

  const handleShareVerse = useCallback(async () => {
    if (!selection) return;
    const verse = getVerseForKey(selection.verseKey);
    if (!verse) return;
    await shareVerseText(verse.aya_text, verse.aya_text);
    clearSelection();
  }, [clearSelection, getVerseForKey, selection]);

  const openSelection = useCallback(
    (word: MushafWordType, element: HTMLElement, mode: "word" | "ayah") => {
      selectedWordElementRef.current = element;
      setSelection({ verseKey: word.verse_key, mode, word });
    },
    [],
  );

  const activateWord = useCallback(
    (fallbackWord: MushafWordType, event: MushafActivationEvent) => {
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        return;
      }

      const line = event.currentTarget.closest(".mushaf-line");
      let element = event.currentTarget;
      let word = fallbackWord;

      /*
       * Only a pointer says *where* it landed, and the glyphs sit close enough
       * together that the element receiving the event is not always the one
       * under the finger. A keyboard activation has no coordinates to resolve
       * and acts on the ayah that held focus.
       */
      if (line && event.detail > 0 && "clientX" in event) {
        const resolved = resolveWordElementInLine(
          line as HTMLElement,
          event.clientX,
          event.clientY,
        );
        if (resolved?.dataset.location) {
          element = resolved;
          word = wordsByLocation.get(resolved.dataset.location) ?? fallbackWord;
        }
      }

      /*
       * Keyboard focus covers a whole ayah, so Enter always opens the ayah's
       * actions. Which word stands in for the run cannot decide that: an ayah
       * running over several lines has its end marker only on the last of
       * them, and every earlier run would otherwise open word actions.
       */
      const isEnd = word.char_type === "end" || !("clientX" in event);

      setSelection((prev) => {
        if (isEnd) {
          if (prev?.mode === "ayah" && prev.verseKey === word.verse_key) {
            selectedWordElementRef.current = null;
            return null;
          }
          selectedWordElementRef.current = element;
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

  const handlePointerDown = useCallback(
    (word: MushafWordType, event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType === "mouse") return;

      const element = event.currentTarget;
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }

      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        openSelection(
          word,
          element,
          word.char_type === "end" ? "ayah" : "word",
        );
      }, 500);
    },
    [openSelection],
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    },
    [],
  );

  const handleListenWord = useCallback(() => {
    if (!selection || selection.mode !== "word") return;

    playback.stop();

    const wordUrl = getWordAudioUrl(
      selection.word.sura,
      selection.word.aya,
      selection.word.word,
    );

    clearSelection();
    setPlayingTarget("word");
    void play(wordUrl);
  }, [selection, playback, play, clearSelection]);

  const handleListenAyah = useCallback(() => {
    if (!selection) return;

    const [sura, aya] = selection.verseKey.split(":").map(Number);
    stop();
    clearSelection();
    setPlayingTarget("ayah");
    void playback.startAyahPlayback(sura!, aya!);
  }, [selection, stop, playback, clearSelection]);

  const handleTafseer = useCallback(() => {
    if (!selection) return;
    const verse = getVerseForKey(selection.verseKey);
    if (verse) setTafseerVerse(verse);
  }, [selection, getVerseForKey]);

  const handleBookmarkToggle = useCallback(() => {
    if (!selection) return;
    toggleBookmark(selection.verseKey);
  }, [selection, toggleBookmark]);

  const selectionBookmarked = selection
    ? isBookmarked(selection.verseKey)
    : false;

  return {
    selection,
    anchorRect,
    playingTarget,
    tafseerVerse,
    setTafseerVerse,
    popoverRef,
    activateWord,
    handlePointerDown,
    handlePointerUp,
    clearSelection,
    handleListenWord,
    handleListenAyah,
    handleTafseer,
    handleCopyVerse,
    handleShareVerse,
    handleBookmarkToggle,
    selectionBookmarked,
    bookmarkedSet,
  };
}
