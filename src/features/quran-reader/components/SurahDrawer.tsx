import { useState } from "react";
import { Search, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import {
  getSurahAyahCount,
  searchSurahNumbers,
  useSurahNames,
} from "@/domain/quran";
import { cn } from "@/shared/lib/utils";
import type { MushafVerse } from "@/domain/quran";

interface SurahDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mushafData: MushafVerse[];
  currentSurah: number | null;
  onSurahSelect: (surahIndex: number) => void;
  onListenToSurah?: (surahNumber: number) => void;
}

export function SurahDrawer({
  open,
  onOpenChange,
  mushafData,
  currentSurah,
  onSurahSelect,
  onListenToSurah,
}: SurahDrawerProps) {
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={tCommon("actions.close")}
        className="fixed inset-y-0 start-0 end-auto top-0 flex h-full w-80 max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-e p-0 sm:max-w-sm"
      >
        <DialogHeader className="border-b px-4 py-4 text-start">
          <DialogTitle>{t("navigation.chooseSurah")}</DialogTitle>
        </DialogHeader>

        <div className="border-b px-4 py-3">
          <div className="relative">
            <Search
              className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              dir="auto"
              aria-label={t("navigation.searchSurah")}
              placeholder={t("navigation.searchSurah")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
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
                    <span
                      dir={language === "ar" ? "rtl" : "ltr"}
                      lang={language}
                    >
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
      </DialogContent>
    </Dialog>
  );
}
