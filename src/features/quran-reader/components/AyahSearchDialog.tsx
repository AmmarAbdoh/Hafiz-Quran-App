import { useEffect, useMemo, useRef, useState } from "react";
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
import { toArabicNumerals } from "@/shared/lib/arabic-numerals";
import { cn } from "@/shared/lib/utils";
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
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
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
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const activeResult = results[activeIndex];
    if (!activeResult) return;
    document
      .getElementById(
        `ayah-search-result-${activeResult.surah}-${activeResult.ayah}`,
      )
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  const selectResult = (surah: number, ayah: number) => {
    onAyahSelect(surah, ayah);
    onOpenChange(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }

    if (event.key === "Home" && results.length > 0) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End" && results.length > 0) {
      event.preventDefault();
      setActiveIndex(results.length - 1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      setActiveIndex(
        (current) => (current - 1 + results.length) % results.length,
      );
      return;
    }

    if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      selectResult(results[activeIndex].surah, results[activeIndex].ayah);
    }
  };

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
                dir="rtl"
                lang="ar"
                placeholder={t("search.placeholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="ps-9 text-right"
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
                  "block w-full border-b border-border px-3 py-2.5 text-right transition-colors last:border-b-0",
                  "hover:bg-accent hover:text-accent-foreground",
                  index === activeIndex && "bg-accent/70",
                )}
              >
                <p className="line-clamp-2 text-sm leading-relaxed">
                  {result.text}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("search.resultMeta", {
                    surahName: result.surahName,
                    ayah: toArabicNumerals(result.ayah),
                  })}
                </p>
              </button>
            ))}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {t("search.resultCount", { count: results.length })}
        </p>

        {results.length > 0 && (
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() =>
              selectResult(
                results[activeIndex]!.surah,
                results[activeIndex]!.ayah,
              )
            }
          >
            {t("search.go")}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
