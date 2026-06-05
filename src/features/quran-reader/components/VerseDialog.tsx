import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { TAFSEER_OPTIONS } from "@/shared/constants/quran";
import { loadTafseer } from "@/shared/services/quran-data";
import type { MushafVerse } from "@/shared/types/quran";

interface VerseDialogProps {
  verse: MushafVerse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VerseDialog({ verse, open, onOpenChange }: VerseDialogProps) {
  const [tafseerId, setTafseerId] = useState("1");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            تفسير الآية
          </DialogTitle>
        </DialogHeader>

        <p className="font-mushaf text-center text-xl leading-loose">
          {verse.aya_text}
        </p>

        <Select value={tafseerId} onValueChange={setTafseerId}>
          <SelectTrigger>
            <SelectValue placeholder="اختر التفسير" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TAFSEER_OPTIONS).map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="rounded-lg bg-muted p-4 text-sm leading-relaxed">
          {loading ? "جاري التحميل..." : tafseerText}
        </div>
      </DialogContent>
    </Dialog>
  );
}
