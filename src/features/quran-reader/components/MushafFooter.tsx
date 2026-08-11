import { PageControls } from "@/features/quran-reader/components/PageControls";
import { MushafFooterPinButton } from "@/features/quran-reader/components/MushafFooterPinButton";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";

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
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const hasStartMeta = surahNames.length > 0 || surahAyahCount !== undefined;
  const hasEndMeta = juzNumber !== undefined || hizbNumber !== undefined;
  const showSingleSurahAyahCount =
    surahNames.length === 1 && surahAyahCount !== undefined;

  return (
    <footer className="mushaf-footer-bar mushaf-footer-bar--with-pin">
      {onPinnedChange && (
        <MushafFooterPinButton
          pinned={pinned}
          onPinnedChange={onPinnedChange}
        />
      )}

      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-1">
        <div className="flex min-w-0 items-center justify-start overflow-hidden">
          {hasStartMeta && (
            <div className="min-w-0 text-right leading-snug">
              {surahNames.length > 0 && (
                <p className="truncate text-sm font-semibold text-foreground">
                  {surahNames.map((name, index) => (
                    <span key={name}>
                      {index > 0 ? (locale === "ar" ? "، " : ", ") : ""}
                      {t("surah")}{" "}
                      <bdi dir="rtl" lang="ar">
                        {name}
                      </bdi>
                    </span>
                  ))}
                </p>
              )}
              {showSingleSurahAyahCount && (
                <p className="text-caption text-muted-foreground">
                  {t("metadata.ayahCount", {
                    count: surahAyahCount,
                    formattedCount: formatNumber(surahAyahCount, locale),
                  })}
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
            <div className="text-left text-caption leading-snug text-muted-foreground">
              {juzNumber !== undefined && (
                <p>
                  {t("metadata.juz", {
                    number:
                      typeof juzNumber === "number"
                        ? formatNumber(juzNumber, locale)
                        : juzNumber,
                  })}
                </p>
              )}
              {hizbNumber !== undefined && (
                <p>
                  {t("metadata.hizb", {
                    number:
                      typeof hizbNumber === "number"
                        ? formatNumber(hizbNumber, locale)
                        : hizbNumber,
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
