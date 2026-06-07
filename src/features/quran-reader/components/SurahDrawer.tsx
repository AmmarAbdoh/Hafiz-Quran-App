import { useState } from "react";
import { Search, Volume2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { SURAH_NAMES } from "@/shared/constants/quran";
import { formatAyahCount } from "@/shared/lib/arabic-count";
import { getSurahAyahCount } from "@/shared/services/quran-data";
import { cn } from "@/shared/lib/utils";
import type { MushafVerse } from "@/shared/types/quran";

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
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = SURAH_NAMES.map((name, index) => ({ name, index })).filter(
    ({ name }) => name.includes(searchTerm),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-y-0 start-0 end-auto top-0 flex h-full w-80 max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-e p-0 sm:max-w-sm">
        <DialogHeader className="border-b px-4 py-4 text-start">
          <DialogTitle>اختر السورة</DialogTitle>
        </DialogHeader>

        <div className="border-b px-4 py-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="ابحث عن السورة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.map(({ name, index }) => {
            const ayahCount = getSurahAyahCount(mushafData, index + 1);
            return (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-1 py-1 transition-colors hover:bg-muted",
                  currentSurah === index && "bg-primary/10",
                )}
              >
                <button
                  type="button"
                  className={cn(
                    "min-w-0 flex-1 px-2 py-1.5 text-start text-sm",
                    currentSurah === index && "font-medium text-primary",
                  )}
                  onClick={() => onSurahSelect(index)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span>
                      {index + 1}. {name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatAyahCount(ayahCount, { arabicNumerals: false })}
                    </span>
                  </span>
                </button>
                {onListenToSurah ? (
                  <button
                    type="button"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-primary"
                    onClick={() => onListenToSurah(index + 1)}
                    aria-label={`استماع سورة ${name}`}
                    title="استماع"
                  >
                    <Volume2 className="h-4 w-4" />
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
