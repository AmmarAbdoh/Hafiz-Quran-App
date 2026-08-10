import { PageControls } from "@/features/quran-reader/components/PageControls";
import { MushafFooterPinButton } from "@/features/quran-reader/components/MushafFooterPinButton";
import { MushafFooterSurahNavButton } from "@/features/quran-reader/components/MushafFooterSurahNavButton";
import { formatAyahCount } from "@/shared/lib/arabic-count";
import { toArabicNumerals } from "@/shared/lib/arabic-numerals";
import { getSurahTashkeelName } from "@/shared/services/quran-data";
import type { MushafVerse } from "@/shared/types/quran";

interface MushafSurahFooterProps {
  surahName: string;
  ayahCount?: number;
  currentSurah: number;
  mushafData: MushafVerse[];
  currentPage: number;
  totalPages: number;
  minPage: number;
  maxPage: number;
  pageSequence: number[];
  juzNumber?: number | string;
  onPageChange: (page: number) => void;
  onSurahChange: (surahNumber: number) => void;
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
}

export function MushafSurahFooter({
  surahName,
  ayahCount,
  currentSurah,
  mushafData,
  currentPage,
  totalPages,
  minPage,
  maxPage,
  pageSequence,
  juzNumber,
  onPageChange,
  onSurahChange,
  pinned = false,
  onPinnedChange,
}: MushafSurahFooterProps) {
  const prevSurah = currentSurah > 1 ? currentSurah - 1 : null;
  const nextSurah = currentSurah < 114 ? currentSurah + 1 : null;
  const prevSurahName =
    prevSurah !== null
      ? getSurahTashkeelName(mushafData, prevSurah)
      : undefined;
  const nextSurahName =
    nextSurah !== null
      ? getSurahTashkeelName(mushafData, nextSurah)
      : undefined;

  return (
    <footer className="mushaf-footer-bar mushaf-footer-bar--with-pin">
      {onPinnedChange && (
        <MushafFooterPinButton pinned={pinned} onPinnedChange={onPinnedChange} />
      )}

      <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-1 sm:gap-2">
        <MushafFooterSurahNavButton
          direction="prev"
          disabled={prevSurah === null}
          surahName={prevSurahName ?? undefined}
          title="السورة السابقة"
          onClick={() => prevSurah !== null && onSurahChange(prevSurah)}
        />

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-center">
            <p className="text-[11px] font-semibold text-foreground sm:text-xs">
              {surahName}
            </p>
            {ayahCount !== undefined && (
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                · {formatAyahCount(ayahCount)}
              </p>
            )}
            {juzNumber !== undefined && (
              <p className="text-[10px] text-muted-foreground sm:text-xs">
                · الجزء {toArabicNumerals(juzNumber)}
              </p>
            )}
          </div>

          <div className="flex justify-center">
            <PageControls
              compact
              currentPage={currentPage}
              totalPages={totalPages}
              minPage={minPage}
              maxPage={maxPage}
              pageSequence={pageSequence}
              onPageChange={onPageChange}
            />
          </div>
        </div>

        <MushafFooterSurahNavButton
          direction="next"
          disabled={nextSurah === null}
          surahName={nextSurahName ?? undefined}
          title="السورة التالية"
          onClick={() => nextSurah !== null && onSurahChange(nextSurah)}
        />
      </div>
    </footer>
  );
}
