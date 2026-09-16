import { useTranslation } from "react-i18next";
import type { MushafReaderHeaderState } from "@/features/quran-reader/context/MushafReaderContext";
import { SurahNavList } from "@/features/quran-reader/components/SurahNavList";

type MushafReaderRailProps = Pick<
  MushafReaderHeaderState,
  "currentSurah" | "onSurahSelect" | "mushafData"
>;

/**
 * A wide screen has room the mushaf cannot use. The page is scaled to fit its
 * stage and its height is what binds there, so at 1920px it is about 460px
 * wide with more than a thousand pixels idle beside it - and moving to another
 * surah still meant opening a dialog over the page being read.
 *
 * The rail puts that list permanently beside the mushaf. It sits outside the
 * size container the page is measured against, so giving it room cannot change
 * the type size.
 */
export function MushafReaderRail({
  currentSurah,
  onSurahSelect,
  mushafData,
}: MushafReaderRailProps) {
  const { t } = useTranslation("reader");

  return (
    <aside
      aria-label={t("navigation.chooseSurah")}
      className="mushaf-reader-rail"
    >
      <h2 className="shrink-0 px-1 pb-3 text-label font-semibold text-muted-foreground">
        {t("navigation.chooseSurah")}
      </h2>
      <SurahNavList
        className="min-h-0 flex-1"
        mushafData={mushafData}
        currentSurah={currentSurah}
        onSurahSelect={onSurahSelect}
      />
    </aside>
  );
}
