import { PageControls } from "@/features/quran-reader/components/PageControls";
import { MushafFooterPinButton } from "@/features/quran-reader/components/MushafFooterPinButton";
import { formatAyahCount } from "@/shared/lib/arabic-count";
import { toArabicNumerals } from "@/shared/lib/arabic-numerals";

interface MushafSurahFooterProps {
  surahName: string;
  ayahCount?: number;
  currentPage: number;
  totalPages: number;
  minPage: number;
  maxPage: number;
  pageSequence: number[];
  juzNumber?: number | string;
  onPageChange: (page: number) => void;
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
}

export function MushafSurahFooter({
  surahName,
  ayahCount,
  currentPage,
  totalPages,
  minPage,
  maxPage,
  pageSequence,
  juzNumber,
  onPageChange,
  pinned = false,
  onPinnedChange,
}: MushafSurahFooterProps) {
  return (
    <footer className="mushaf-footer-bar mushaf-footer-bar--with-pin">
      {onPinnedChange && (
        <MushafFooterPinButton pinned={pinned} onPinnedChange={onPinnedChange} />
      )}

      <div className="mx-auto flex max-w-6xl flex-col gap-1.5">
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
    </footer>
  );
}
