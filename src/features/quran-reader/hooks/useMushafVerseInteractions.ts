import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useQuranPlaybackActions } from "@/features/quran-reader/context/QuranPlaybackContext";
import { useQuranPlaybackState } from "@/features/quran-reader/context/QuranPlaybackContext";
import { useQuranAudio } from "@/features/quran-reader/hooks/useQuranAudio";
import type { VerseSelection } from "@/features/quran-reader/model/selection";
import { resolveWordElementInLine } from "@/features/quran-reader/model/mushafWordHitTest";
import { getWordAudioUrl } from "@/domain/quran";
import { findMushafVerse } from "@/domain/quran";
import type {
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
  const playback = useQuranPlaybackActions();
  const playbackState = useQuranPlaybackState();
  const { play, stop, playing } = useQuranAudio();

  const clearSelection = useCallback(() => {
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

  const activateWord = useCallback(
    (fallbackWord: MushafWordType, event: React.MouseEvent<HTMLElement>) => {
      const line = event.currentTarget.closest(".mushaf-line");
      let element = event.currentTarget;
      let word = fallbackWord;

      const pointerGenerated = event.detail > 0;

      if (line && pointerGenerated) {
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

      const isEnd = word.char_type === "end";

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

  return {
    selection,
    anchorRect,
    playingTarget,
    tafseerVerse,
    setTafseerVerse,
    popoverRef,
    activateWord,
    clearSelection,
    handleListenWord,
    handleListenAyah,
    handleTafseer,
  };
}
