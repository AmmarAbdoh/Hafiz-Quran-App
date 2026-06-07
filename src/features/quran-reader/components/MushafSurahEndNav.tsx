import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatAyahCount } from "@/shared/lib/arabic-count";
import {
  getSurahAyahCount,
  getSurahTashkeelName,
} from "@/shared/services/quran-data";
import type { MushafVerse } from "@/shared/types/quran";

interface MushafSurahEndNavProps {
  currentSurah: number;
  mushafData: MushafVerse[];
  onSurahChange: (surahNumber: number) => void;
}

export function MushafSurahEndNav({
  currentSurah,
  mushafData,
  onSurahChange,
}: MushafSurahEndNavProps) {
  const prevSurah = currentSurah > 1 ? currentSurah - 1 : null;
  const nextSurah = currentSurah < 114 ? currentSurah + 1 : null;

  if (!prevSurah && !nextSurah) return null;

  const prevName = prevSurah
    ? getSurahTashkeelName(mushafData, prevSurah)
    : null;
  const nextName = nextSurah
    ? getSurahTashkeelName(mushafData, nextSurah)
    : null;
  const prevAyahs =
    prevSurah !== null ? getSurahAyahCount(mushafData, prevSurah) : undefined;
  const nextAyahs =
    nextSurah !== null ? getSurahAyahCount(mushafData, nextSurah) : undefined;

  return (
    <nav
      className="mushaf-surah-end-nav"
      aria-label="التنقل بين السور"
    >
      {prevSurah && prevName ? (
        <button
          type="button"
          className="mushaf-surah-end-nav__link mushaf-surah-end-nav__link--prev"
          onClick={() => onSurahChange(prevSurah)}
        >
          <ChevronRight className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span className="min-w-0 text-right">
            <span className="block text-[11px] text-muted-foreground">
              السورة السابقة
            </span>
            <span className="block truncate text-sm font-semibold text-foreground">
              {prevName}
            </span>
            {prevAyahs !== undefined && (
              <span className="block text-xs text-muted-foreground">
                {formatAyahCount(prevAyahs)}
              </span>
            )}
          </span>
        </button>
      ) : (
        <div aria-hidden />
      )}

      {nextSurah && nextName ? (
        <button
          type="button"
          className="mushaf-surah-end-nav__link mushaf-surah-end-nav__link--next"
          onClick={() => onSurahChange(nextSurah)}
        >
          <span className="min-w-0 text-left">
            <span className="block text-[11px] text-muted-foreground">
              السورة التالية
            </span>
            <span className="block truncate text-sm font-semibold text-foreground">
              {nextName}
            </span>
            {nextAyahs !== undefined && (
              <span className="block text-xs text-muted-foreground">
                {formatAyahCount(nextAyahs)}
              </span>
            )}
          </span>
          <ChevronLeft className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </button>
      ) : (
        <div aria-hidden />
      )}
    </nav>
  );
}
