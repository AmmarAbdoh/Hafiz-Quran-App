import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Save } from "lucide-react";
import { formatNumber, useLocale } from "@/app/i18n";
import type { PracticeSummaryProps } from "@/features/recitation-practice/contract";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
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
  progressIndex,
  stoppedShort,
  onSaveRun,
  onPractiseAgain,
}: PracticeSummaryProps) {
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");
  const { locale } = useLocale();
  /*
   * Development only, and deliberately at the end of a run: this is the one
   * moment the reciter knows what actually happened, and their note is the
   * label the recording needs. Every threshold so far was measured on
   * professional reciters, whose mistakes had to be manufactured.
   */
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /*
   * A fresh run gets a fresh note.
   *
   * This sheet is kept mounted between runs, so the note and the name of the
   * file it was saved to survived into the next recitation - the reader saw
   * "recorded-...wav" reported for a run nobody had saved, and whatever they
   * had typed about the last one still in the box. Adjusted during render
   * rather than in an effect, which is what React asks for when state has to
   * follow a prop.
   */
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNote("");
      setSaved(null);
    }
  }

  const save = async () => {
    if (!onSaveRun) return;
    setSaving(true);
    try {
      setSaved(await onSaveRun(note));
    } catch (error) {
      setSaved(error instanceof Error ? error.message : "failed");
    } finally {
      setSaving(false);
    }
  };

  /*
   * Only a finished recitation can be a clean one.
   *
   * Stopping a third of the way through is not a page recited correctly, and
   * saying so was this screen's worst failure: it reported three words of a
   * hundred and twenty as a clean, complete page. The words that were
   * recited may well have been right, so it says that too rather than
   * pretending something was misread.
   */
  const clean = misreadWords.length === 0 && !stoppedShort;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={tCommon("actions.close")} className="gap-5">
        <SheetHeader>
          <SheetTitle>{t("practice.summary.title")}</SheetTitle>
          <SheetDescription>
            {clean
              ? t("practice.summary.clean")
              : stoppedShort && misreadWords.length === 0
                ? t("practice.summary.stoppedShort", {
                    reached: formatNumber(progressIndex, locale),
                    total: formatNumber(totalWords, locale),
                  })
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
        ) : misreadWords.length === 0 ? (
          /* Stopped early with nothing misread: there is no list to show,
             and an empty one read as a clean page by another route. */
          <p className="py-6 text-center text-body text-muted-foreground">
            {t("practice.summary.stoppedShortDetail")}
          </p>
        ) : (
          /* Capped so a bad run does not make a sheet the length of a page. */
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {misreadWords.map((word) => (
              <li
                key={word.location}
                className="flex min-h-11 items-start justify-between gap-3 rounded-lg px-3 py-2 odd:bg-surface-sunken"
              >
                <div className="min-w-0 space-y-0.5">
                  <bdi dir="rtl" lang="ar" className="block truncate text-body">
                    {word.text}
                  </bdi>
                  {/*
                   * What was heard in its place.
                   *
                   * The word on its own answers "which one" and leaves the
                   * question that matters: a reciter looking at a word they
                   * believe they recited correctly has nothing to work with.
                   * These are the recogniser's phonemes written as letters,
                   * so they are an approximation of the sounds rather than a
                   * word from the Quran - shown as heard, in the colour of a
                   * mistake, and never as text to read. See
                   * `phonemesAsLetters`.
                   */}
                  {"letters" in word.heard && (
                    <p className="truncate text-label text-destructive">
                      <span className="text-muted-foreground">
                        {t("practice.summary.heard")}
                      </span>{" "}
                      <bdi dir="rtl" lang="ar">
                        {word.heard.letters}
                      </bdi>
                    </p>
                  )}
                  {/* And why it is listed, where the line above does not
                      already say it. */}
                  {REASONS[word.heard.kind] && (
                    <p className="text-label text-muted-foreground">
                      {t(REASONS[word.heard.kind]!)}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-label tabular-nums text-muted-foreground">
                  {t("practice.summary.ayah", {
                    reference: formatVerseKey(word.verseKey, locale),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}

        {onSaveRun && (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <p className="text-label text-muted-foreground">
              {t("practice.summary.keepRun")}
            </p>
            <div className="flex gap-2">
              <Input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("practice.summary.keepRunNote")}
                aria-label={t("practice.summary.keepRunNote")}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void save()}
                disabled={saving}
              >
                <Save className="h-4 w-4" aria-hidden />
                {t("practice.summary.keepRunSave")}
              </Button>
            </div>
            {saved && (
              <p
                aria-live="polite"
                className="text-label text-muted-foreground"
              >
                {saved}
              </p>
            )}
          </div>
        )}

        <p className="rounded-lg border border-border bg-surface-sunken px-3 py-2 text-label leading-6 text-muted-foreground">
          {t("practice.summary.disclaimer")}
        </p>

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

/**
 * The note under a word, naming why it is in the list.
 *
 * `other` has none: the line above it already says what was heard there, and
 * a note repeating that in words would only take up the row.
 */
const REASONS = {
  nothing: "practice.summary.nothingHeard",
  unclear: "practice.summary.unclear",
  stumble: "practice.summary.stumbled",
  gaveUp: "practice.summary.gaveUp",
  other: null,
} as const;

/** `2:255` as the reader's own numerals, with the colon kept between them. */
function formatVerseKey(
  verseKey: string,
  locale: Parameters<typeof formatNumber>[1],
) {
  const [surah, ayah] = verseKey.split(":");
  return `${formatNumber(Number(surah), locale)}:${formatNumber(Number(ayah), locale)}`;
}
