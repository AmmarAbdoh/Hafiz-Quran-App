import { useEffect, useState } from "react";
import { SURAH_NAMES, TAFSEER_OPTIONS, useTafseer } from "@/domain/quran";
import { BookOpen, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { SearchableRtlSelect } from "@/shared/components/SearchableRtlSelect";
import { loadTafseer } from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";

interface VerseDialogProps {
  verse: MushafVerse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VerseDialog({ verse, open, onOpenChange }: VerseDialogProps) {
  const { t } = useTranslation("reader");
  const { t: tCommon } = useTranslation("common");
  const { locale } = useLocale();
  const { tafseerId, setTafseerId } = useTafseer();
  const [tafseerText, setTafseerText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    if (!verse || !open) return;

    let cancelled = false;
    setLoading(true);
    setLoadFailed(false);
    setTafseerText("");

    loadTafseer(tafseerId, verse.sura_no, verse.aya_no)
      .then((text) => {
        if (!cancelled) {
          setTafseerText(text);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [verse, open, tafseerId, requestVersion]);

  if (!verse) return null;

  const surahName = SURAH_NAMES[verse.sura_no - 1];
  const tafseerName = TAFSEER_OPTIONS[tafseerId];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={tCommon("actions.close")}
        className="flex max-h-[min(92vh,56rem)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
      >
        <div className="border-b border-primary/15 bg-primary/5 px-5 py-4 pe-14 sm:px-6">
          <DialogHeader className="space-y-1 text-start">
            <DialogTitle className="flex items-center justify-start gap-2.5 text-xl sm:text-2xl">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" aria-hidden />
              </span>
              {t("tafsirDialog.title")}
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              {t("surah")}{" "}
              <bdi dir="rtl" lang="ar">
                {surahName}
              </bdi>{" "}
              — {t("ayah")} {formatNumber(verse.aya_no, locale)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="border-b bg-muted/25 px-5 py-5 sm:px-6 sm:py-6">
          <p
            className="quran-text font-mushaf text-center text-2xl leading-[2.2] sm:text-3xl sm:leading-[2.4]"
            dir="rtl"
            lang="ar"
          >
            {verse.aya_text}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-b bg-background px-5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
          <Label
            htmlFor="tafseer-source"
            className="shrink-0 text-sm font-semibold text-foreground sm:text-base"
          >
            {t("tafsirDialog.source")}
          </Label>
          <div className="w-full sm:flex-1">
            <SearchableRtlSelect
              id="tafseer-source"
              value={tafseerId}
              onValueChange={setTafseerId}
              placeholder={t("tafsirDialog.choose")}
              searchPlaceholder={t("tafsirDialog.search")}
              emptyMessage={t("tafsirDialog.empty")}
              options={Object.entries(TAFSEER_OPTIONS).map(([id, name]) => ({
                value: id,
                label: name,
              }))}
            />
          </div>
        </div>

        <div className="app-main-scroll min-h-[min(50vh,28rem)] flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          {loading ? (
            <div
              className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              <Loader2
                className="h-8 w-8 animate-spin text-primary"
                aria-hidden
              />
              <p className="text-base">{t("tafsirDialog.loading")}</p>
            </div>
          ) : loadFailed ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <p className="text-sm text-destructive" role="alert">
                {t("tafsirDialog.error")}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRequestVersion((version) => version + 1)}
              >
                {t("tafsirDialog.retry")}
              </Button>
            </div>
          ) : (
            <article
              className="rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:p-6"
              dir="rtl"
              lang="ar"
            >
              {tafseerName && (
                <p className="mb-4 border-b border-border/60 pb-3 text-sm font-semibold text-primary sm:text-base">
                  {tafseerName}
                </p>
              )}
              <p className="text-justify text-lg leading-[2] text-foreground sm:text-xl sm:leading-[2.1]">
                {tafseerText}
              </p>
            </article>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
