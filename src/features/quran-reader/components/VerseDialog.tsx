import { useEffect, useState } from "react";
import { useTafseer } from "@/shared/hooks/use-tafseer";
import { BookOpen, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { SearchableRtlSelect } from "@/shared/components/SearchableRtlSelect";
import { SURAH_NAMES, TAFSEER_OPTIONS } from "@/shared/constants/quran";
import { toArabicNumerals } from "@/shared/lib/arabic-numerals";
import { loadTafseer } from "@/shared/services/quran-data";
import type { MushafVerse } from "@/shared/types/quran";

interface VerseDialogProps {
  verse: MushafVerse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VerseDialog({ verse, open, onOpenChange }: VerseDialogProps) {
  const { tafseerId, setTafseerId } = useTafseer();
  const [tafseerText, setTafseerText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!verse || !open) return;

    let cancelled = false;
    setLoading(true);

    loadTafseer(tafseerId, verse.sura_no, verse.aya_no)
      .then((text) => {
        if (!cancelled) {
          setTafseerText(text);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTafseerText("تعذر تحميل التفسير.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [verse, open, tafseerId]);

  if (!verse) return null;

  const surahName = SURAH_NAMES[verse.sura_no - 1];
  const tafseerName = TAFSEER_OPTIONS[tafseerId];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="flex max-h-[min(92vh,56rem)] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:rounded-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="border-b border-primary/15 bg-primary/5 px-5 py-4 pe-14 sm:px-6">
          <DialogHeader className="space-y-1 text-right">
            <DialogTitle className="flex items-center justify-start gap-2.5 text-xl sm:text-2xl">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </span>
              تفسير الآية
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              سورة {surahName} — الآية {toArabicNumerals(verse.aya_no)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="border-b bg-muted/25 px-5 py-5 sm:px-6 sm:py-6">
          <p className="quran-text font-mushaf text-center text-2xl leading-[2.2] sm:text-3xl sm:leading-[2.4]">
            {verse.aya_text}
          </p>
        </div>

        <div className="flex flex-col gap-2 border-b bg-background px-5 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
          <Label
            htmlFor="tafseer-source"
            className="shrink-0 text-sm font-semibold text-foreground sm:text-base"
          >
            مصدر التفسير
          </Label>
          <div className="w-full sm:flex-1">
            <SearchableRtlSelect
              id="tafseer-source"
              value={tafseerId}
              onValueChange={setTafseerId}
              placeholder="اختر التفسير"
              searchPlaceholder="ابحث عن تفسير..."
              emptyMessage="لا يوجد تفسير بهذا الاسم"
              options={Object.entries(TAFSEER_OPTIONS).map(([id, name]) => ({
                value: id,
                label: name,
              }))}
            />
          </div>
        </div>

        <div className="app-main-scroll min-h-[min(50vh,28rem)] flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          {loading ? (
            <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-base">جاري تحميل التفسير...</p>
            </div>
          ) : (
            <article className="rounded-xl border border-border/80 bg-card p-5 shadow-sm sm:p-6">
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
