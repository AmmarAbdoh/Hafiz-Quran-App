import { BookOpen, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MushafLayoutMode } from "@/features/quran-reader/model/quranReaderRoutes";
import { SegmentedControl } from "@/shared/components/SegmentedControl";

interface MushafLayoutSwitcherProps {
  layoutMode: MushafLayoutMode;
  onLayoutModeChange: (mode: MushafLayoutMode) => void;
}

export function MushafLayoutSwitcher({
  layoutMode,
  onLayoutModeChange,
}: MushafLayoutSwitcherProps) {
  const { t } = useTranslation("reader");

  return (
    <SegmentedControl
      aria-label={t("layout.label")}
      value={layoutMode}
      onValueChange={onLayoutModeChange}
      options={[
        {
          value: "surah",
          label: (
            <>
              <BookOpen className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span>{t("layout.surah")}</span>
            </>
          ),
        },
        {
          value: "page",
          label: (
            <>
              <FileText className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
              <span>{t("layout.page")}</span>
            </>
          ),
        },
      ]}
    />
  );
}
