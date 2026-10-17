import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { formatNumber, useLocale } from "@/app/i18n";
import type { PracticeSummaryProps } from "@/features/recitation-practice/contract";
import { Button } from "@/shared/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/Sheet";

/**
 * What to work on, once a recitation has finished.
 *
 * The feature could previously only say that something had gone wrong, and
 * only for as long as the red flash lasted. The point of keeping every
 * misread word is this screen: at the end you are told which words to go
 * back to, which is the thing a memorizer actually needs.
 */
export function PracticeSummary({
  open,
  onOpenChange,
  misreadWords,
  totalWords,
  onPractiseAgain,
}: PracticeSummaryProps) {
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");
  const { locale } = useLocale();

  const clean = misreadWords.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={tCommon("actions.close")} className="gap-5">
        <SheetHeader>
          <SheetTitle>{t("practice.summary.title")}</SheetTitle>
          <SheetDescription>
            {clean
              ? t("practice.summary.clean")
              : t("practice.summary.needWork", {
                  count: misreadWords.length,
                  words: formatNumber(misreadWords.length, locale),
                  total: formatNumber(totalWords, locale),
                })}
          </SheetDescription>
        </SheetHeader>

        {clean ? (
          <p className="flex items-center justify-center gap-2 py-6 text-body text-primary">
            <Check className="h-5 w-5" aria-hidden />
            {t("practice.summary.cleanDetail")}
          </p>
        ) : (
          /* Capped so a bad run does not make a sheet the length of a page. */
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {misreadWords.map((word) => (
              <li
                key={word.location}
                className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 odd:bg-surface-sunken"
              >
                <bdi dir="rtl" lang="ar" className="truncate text-body">
                  {word.text}
                </bdi>
                <span className="shrink-0 text-label tabular-nums text-muted-foreground">
                  {t("practice.summary.ayah", {
                    reference: formatVerseKey(word.verseKey, locale),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            {tCommon("actions.done")}
          </Button>
          <Button
            type="button"
            size="lg"
            className="w-full sm:w-auto"
            onClick={onPractiseAgain}
          >
            {t("practice.summary.again")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** `2:255` as the reader's own numerals, with the colon kept between them. */
function formatVerseKey(
  verseKey: string,
  locale: Parameters<typeof formatNumber>[1],
) {
  const [surah, ayah] = verseKey.split(":");
  return `${formatNumber(Number(surah), locale)}:${formatNumber(Number(ayah), locale)}`;
}
