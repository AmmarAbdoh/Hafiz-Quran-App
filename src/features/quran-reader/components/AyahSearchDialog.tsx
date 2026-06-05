import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { SURAH_NAMES } from "@/shared/constants/quran";
import {
  findMushafVerse,
  getSurahAyahCount,
} from "@/shared/services/quran-data";
import type { MushafVerse } from "@/shared/types/quran";

interface AyahSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mushafData: MushafVerse[];
  onAyahSelect: (surah: number, ayah: number) => void;
}

function parseVerseInput(raw: string): { surah: number; ayah: number } | null {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,3})[:\u061a/](\d{1,3})$/);
  if (!match) return null;

  const surah = parseInt(match[1]!, 10);
  const ayah = parseInt(match[2]!, 10);
  if (surah < 1 || surah > 114 || ayah < 1) return null;

  return { surah, ayah };
}

export function AyahSearchDialog({
  open,
  onOpenChange,
  mushafData,
  onAyahSelect,
}: AyahSearchDialogProps) {
  const [surahInput, setSurahInput] = useState("");
  const [ayahInput, setAyahInput] = useState("");
  const [combinedInput, setCombinedInput] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setSurahInput("");
      setAyahInput("");
      setCombinedInput("");
      setError("");
    }
  }, [open]);

  const resolveInputs = (): { surah: number; ayah: number } | null => {
    const combined = parseVerseInput(combinedInput);
    if (combined) return combined;

    const surah = parseInt(surahInput, 10);
    const ayah = parseInt(ayahInput, 10);
    if (isNaN(surah) || isNaN(ayah)) return null;
    if (surah < 1 || surah > 114 || ayah < 1) return null;

    return { surah, ayah };
  };

  const handleSearch = () => {
    const parsed = resolveInputs();
    if (!parsed) {
      setError("أدخل سورة وآية صحيحة (مثال: ٢:٢٥٥)");
      return;
    }

    const maxAyah = getSurahAyahCount(mushafData, parsed.surah);
    if (parsed.ayah > maxAyah) {
      setError(
        `السورة ${SURAH_NAMES[parsed.surah - 1]} فيها ${maxAyah} آية فقط`,
      );
      return;
    }

    const verse = findMushafVerse(mushafData, parsed.surah, parsed.ayah);
    if (!verse) {
      setError("لم يتم العثور على الآية");
      return;
    }

    onAyahSelect(parsed.surah, parsed.ayah);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>البحث عن آية</DialogTitle>
          <DialogDescription>
            انتقل مباشرة إلى صفحة الآية مع تمييزها لفترة قصيرة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="ayah-combined">سورة:آية</Label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ayah-combined"
                placeholder="مثال: 2:255"
                value={combinedInput}
                onChange={(e) => {
                  setCombinedInput(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="ps-9"
                inputMode="text"
              />
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">أو</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ayah-surah">رقم السورة</Label>
              <Input
                id="ayah-surah"
                placeholder="١–١١٤"
                value={surahInput}
                onChange={(e) => {
                  setSurahInput(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ayah-number">رقم الآية</Label>
              <Input
                id="ayah-number"
                placeholder="رقم الآية"
                value={ayahInput}
                onChange={(e) => {
                  setAyahInput(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                inputMode="numeric"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSearch} className="w-full sm:w-auto">
            انتقل إلى الآية
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
