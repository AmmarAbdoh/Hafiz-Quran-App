import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import type { MushafVerse } from "@/domain/quran";
import { SurahNavList } from "@/features/quran-reader/components/SurahNavList";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={tCommon("actions.close")}
        className="flex max-h-[min(90vh,720px)] max-w-md flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="border-b px-4 py-4 text-start">
          <DialogTitle>{t("navigation.chooseSurah")}</DialogTitle>
        </DialogHeader>

        {/* The same list the wide-screen rail shows, in a dialog. */}
        <SurahNavList
          className="p-4 pt-3"
          mushafData={mushafData}
          currentSurah={currentSurah}
          onSurahSelect={(index) => {
            onSurahSelect(index);
            onOpenChange(false);
          }}
          onListenToSurah={onListenToSurah}
        />
      </DialogContent>
    </Dialog>
  );
}
