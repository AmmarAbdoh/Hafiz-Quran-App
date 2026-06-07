import { PageControls } from "@/features/quran-reader/components/PageControls";
import { MushafFooterPinButton } from "@/features/quran-reader/components/MushafFooterPinButton";
import { formatAyahCount } from "@/shared/lib/arabic-count";
import { toArabicNumerals } from "@/shared/lib/arabic-numerals";

interface MushafFooterProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  surahNames?: string[];
  surahAyahCount?: number;
  juzNumber?: number | string;
  hizbNumber?: number | string;
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
}

export function MushafFooter({
  currentPage,
  totalPages,
  onPageChange,
  surahNames = [],
  surahAyahCount,
  juzNumber,
  hizbNumber,
  pinned = false,
  onPinnedChange,
}: MushafFooterProps) {
  const hasStartMeta = surahNames.length > 0 || surahAyahCount !== undefined;
  const hasEndMeta = juzNumber !== undefined || hizbNumber !== undefined;
  const showSingleSurahAyahCount =
    surahNames.length === 1 && surahAyahCount !== undefined;

  return (
    <footer className="mushaf-footer-bar mushaf-footer-bar--with-pin">
      {onPinnedChange && (
        <MushafFooterPinButton pinned={pinned} onPinnedChange={onPinnedChange} />
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-1">
        <div className="flex min-w-0 items-center justify-start overflow-hidden">
          {hasStartMeta && (
            <div className="min-w-0 text-right leading-snug">
              {surahNames.length > 0 && (
                <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
                  {surahNames.map((name) => `سورة ${name}`).join("، ")}
                </p>
              )}
              {showSingleSurahAyahCount && (
                <p className="text-[10px] text-muted-foreground sm:text-xs">
                  {formatAyahCount(surahAyahCount)}
                </p>
              )}
            </div>
          )}
        </div>

        <PageControls
          compact
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />

        <div className="flex min-w-0 items-center justify-end overflow-hidden">
          {hasEndMeta && (
            <div className="text-left text-[10px] leading-snug text-muted-foreground sm:text-xs">
              {juzNumber !== undefined && (
                <p>الجزء {toArabicNumerals(juzNumber)}</p>
              )}
              {hizbNumber !== undefined && (
                <p>الحزب {toArabicNumerals(hizbNumber)}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
