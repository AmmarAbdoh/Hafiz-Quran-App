import { useState } from "react";
import { Search, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import {
  getSurahAyahCount,
  searchSurahNumbers,
  useSurahNames,
} from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/shared/lib/utils";

interface SurahNavListProps {
  mushafData: MushafVerse[];
  /** Zero-based, as the reader's route index is. */
  currentSurah: number | null;
  onSurahSelect: (surahIndex: number) => void;
  onListenToSurah?: (surahNumber: number) => void;
  searchId?: string;
  className?: string;
}

/**
 * The searchable list of all 114 surahs, shared by the drawer a phone opens
 * and the rail a wide screen always shows.
 */
export function SurahNavList({
  mushafData,
  currentSurah,
  onSurahSelect,
  onListenToSurah,
  searchId,
  className,
}: SurahNavListProps) {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const { names, language } = useSurahNames();
  const [searchTerm, setSearchTerm] = useState("");

  // Matches either script and tolerates a dropped article, so "بقره" and
  // "baqarah" both find البقرة; a lowercase includes did neither.
  const matches = searchSurahNumbers(searchTerm);
  const filtered = names
    .map((name, index) => ({ name, index }))
    .filter(({ index }) => matches === null || matches.includes(index + 1))
    .sort((left, right) =>
      matches === null
        ? 0
        : matches.indexOf(left.index + 1) - matches.indexOf(right.index + 1),
    );

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="relative shrink-0">
        <Search
          aria-hidden
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={searchId}
          dir="auto"
          aria-label={t("navigation.searchSurah")}
          placeholder={t("navigation.searchSurah")}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="ps-9"
        />
      </div>

      <div className="app-main-scroll mt-2 min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p
            className="px-3 py-8 text-center text-sm text-muted-foreground"
            role="status"
          >
            {t("navigation.noSurahs")}
          </p>
        )}
        {filtered.map(({ name, index }) => {
          const ayahCount = getSurahAyahCount(mushafData, index + 1);
          return (
            <div
              key={index}
              className={cn(
                "flex items-center gap-1 rounded-md px-1 py-1 transition-colors duration-fast ease-standard hover:bg-surface-hover",
                currentSurah === index && "bg-surface-selected",
              )}
            >
              <button
                type="button"
                className={cn(
                  "min-h-11 min-w-0 flex-1 px-2 py-1.5 text-start text-label",
                  currentSurah === index && "font-medium text-primary",
                )}
                onClick={() => onSurahSelect(index)}
                aria-current={currentSurah === index ? "page" : undefined}
              >
                <span className="flex items-center justify-between gap-2">
                  <span dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
                    <bdi>{formatNumber(index + 1, locale)}</bdi>. {name}
                  </span>
                  <span className="text-label text-muted-foreground">
                    {t("metadata.ayahCount", {
                      count: ayahCount,
                      formattedCount: formatNumber(ayahCount, locale),
                    })}
                  </span>
                </span>
              </button>
              {onListenToSurah ? (
                <button
                  type="button"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-primary"
                  onClick={() => onListenToSurah(index + 1)}
                  aria-label={t("navigation.listenSurah", { name })}
                  title={t("listen")}
                >
                  <Volume2 className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
