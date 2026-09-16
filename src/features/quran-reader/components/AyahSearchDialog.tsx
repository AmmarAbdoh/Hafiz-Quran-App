import { useEffect, useMemo, useRef, useState } from "react";
import { useListNavigation } from "@/shared/hooks/useListNavigation";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  buildAyahSearchIndex,
  searchAyahsByText,
} from "@/features/quran-reader/model/ayahTextSearch";
import { formatNumber, useLocale } from "@/app/i18n";
import { cn } from "@/shared/lib/utils";
import { useSurahNames } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";

interface AyahSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mushafData: MushafVerse[];
  onAyahSelect: (surah: number, ayah: number) => void;
}

export function AyahSearchDialog({
  open,
  onOpenChange,
  mushafData,
  onAyahSelect,
}: AyahSearchDialogProps) {
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");
  const { locale } = useLocale();
  const { surahName } = useSurahNames();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const searchIndex = useMemo(
    () => buildAyahSearchIndex(mushafData),
    [mushafData],
  );

  const results = useMemo(
    () => searchAyahsByText(searchIndex, query),
    [searchIndex, query],
  );

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(frame);
    }

    if (!open) {
      setQuery("");
    }
  }, [open]);

  const selectResult = (surah: number, ayah: number) => {
    onAyahSelect(surah, ayah);
    onOpenChange(false);
  };

  const { activeIndex, setActiveIndex, onKeyDown } = useListNavigation({
    count: results.length,
    onSelect: (index) => {
      const result = results[index];
      if (result) selectResult(result.surah, result.ayah);
    },
    onDismiss: () => onOpenChange(false),
    resetKey: query,
  });

  const activeResult = results[activeIndex];

  useEffect(() => {
    if (!activeResult) return;
    document
      .getElementById(
        `ayah-search-result-${activeResult.surah}-${activeResult.ayah}`,
      )
      ?.scrollIntoView({ block: "nearest" });
  }, [activeResult]);
  const trimmedQuery = query.trim();
  const showMinLengthHint =
    trimmedQuery.length > 0 && trimmedQuery.length < 2 && results.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={tCommon("actions.close")} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("search.title")}</DialogTitle>
          <DialogDescription>{t("search.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-2">
            <Label htmlFor="ayah-text-search">{t("search.label")}</Label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ayah-text-search"
                ref={inputRef}
                /* Not rtl/ar: the field accepts an Arabic ayah, a surah name
                   in either script, and a reference like 2:255, so it cannot
                   be one language. "auto" takes its direction from what is
                   actually typed, a character at a time. */
                dir="auto"
                placeholder={t("search.placeholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                className="ps-9"
                autoComplete="off"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="ayah-search-results"
                aria-expanded={open}
                aria-activedescendant={
                  results[activeIndex]
                    ? `ayah-search-result-${results[activeIndex].surah}-${results[activeIndex].ayah}`
                    : undefined
                }
              />
            </div>
          </div>

          <div
            id="ayah-search-results"
            role="listbox"
            aria-label={t("search.results")}
            className="app-main-scroll max-h-[min(18rem,45vh)] overflow-y-auto rounded-md border border-border"
          >
            {showMinLengthHint && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("search.minimum")}
              </p>
            )}

            {!showMinLengthHint &&
              trimmedQuery.length >= 2 &&
              results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t("search.empty")}
                </p>
              )}

            {!showMinLengthHint && trimmedQuery.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("search.start")}
              </p>
            )}

            {results.map((result, index) => (
              <button
                key={`${result.surah}:${result.ayah}`}
                id={`ayah-search-result-${result.surah}-${result.ayah}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectResult(result.surah, result.ayah)}
                className={cn(
                  "block w-full border-b border-border px-3 py-2.5 text-start transition-colors duration-fast ease-standard last:border-b-0",
                  "hover:bg-surface-hover",
                  index === activeIndex && "bg-surface-hover",
                )}
              >
                {/* The ayah is Arabic whatever the interface language is, so
                    it carries its own direction rather than inheriting one. */}
                <p
                  dir="rtl"
                  lang="ar"
                  className="line-clamp-2 text-sm leading-relaxed"
                >
                  {result.text}
                </p>
                <p className="mt-1 text-label text-muted-foreground">
                  {t("search.resultMeta", {
                    surahName: surahName(result.surah),
                    ayah: formatNumber(result.ayah, locale),
                  })}
                </p>
              </button>
            ))}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {t("search.resultCount", { count: results.length })}
        </p>

        {activeResult && (
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => selectResult(activeResult.surah, activeResult.ayah)}
          >
            {/* The key has always taken a label. Nothing passed one, so the
                button read "Go to" and named nothing. */}
            {t("search.go", {
              label: t("search.resultMeta", {
                surahName: surahName(activeResult.surah),
                ayah: formatNumber(activeResult.ayah, locale),
              }),
            })}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
