import { useEffect } from "react";
import { getAdjacentPageInSequence } from "@/features/quran-reader/hooks/useMushafScrollPageSpy";
import type { MushafLayoutMode } from "@/features/quran-reader/model/quranReaderRoutes";

interface UseReaderKeyboardNavigationOptions {
  enabled: boolean;
  layoutMode: MushafLayoutMode;
  currentPage: number;
  surahPages: number[];
  visibleSurahPage: number;
  changePage: (page: number) => void;
  changeSurahPage: (page: number) => void;
}

export function useReaderKeyboardNavigation({
  enabled,
  layoutMode,
  currentPage,
  surahPages,
  visibleSurahPage,
  changePage,
  changeSurahPage,
}: UseReaderKeyboardNavigationOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      if (layoutMode === "surah") {
        const direction =
          event.key === "ArrowRight"
            ? "prev"
            : event.key === "ArrowLeft"
              ? "next"
              : null;
        if (!direction) return;

        event.preventDefault();
        const page = getAdjacentPageInSequence(
          surahPages,
          visibleSurahPage,
          direction,
        );
        if (page !== null) changeSurahPage(page);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        changePage(currentPage - 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        changePage(currentPage + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    changePage,
    changeSurahPage,
    currentPage,
    enabled,
    layoutMode,
    surahPages,
    visibleSurahPage,
  ]);
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
