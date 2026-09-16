import { useTranslation } from "react-i18next";
import {
  MushafPageView,
  type MushafPageLayout,
  type MushafVerse,
  type MushafWordActivateHandler,
  type MushafWordPointerHandler,
} from "@/domain/quran";
import type { VerseSelection } from "@/features/quran-reader/model/selection";
import type { Theme } from "@/shared/hooks/use-theme";

const EMPTY_MUSHAF_DATA: MushafVerse[] = [];
const EMPTY_LOCATIONS: string[] = [];

interface MushafPageBlockProps {
  pageLayout: MushafPageLayout;
  mushafData?: MushafVerse[];
  tajweedColored: boolean;
  theme: Theme;
  loadFont?: boolean;
  highlightVerseKey?: string | null;
  selection?: VerseSelection | null;
  recitationVerseKey?: string | null;
  recitationWordLocation?: string | null;
  practiceMode?: boolean;
  practiceHideAyat?: boolean;
  practiceRevealedLocations?: string[];
  practiceTargetWordLocation?: string | null;
  practiceWrongFlashLocation?: string | null;
  bookmarkedVerseKeys?: ReadonlySet<string>;
  onWordActivate?: MushafWordActivateHandler;
  onWordPointerDown?: MushafWordPointerHandler;
  onWordPointerUp?: () => void;
  onWordPointerCancel?: () => void;
  className?: string;
  id?: string;
  surahFilter?: number;
}

export function MushafPageBlock({
  pageLayout,
  mushafData = EMPTY_MUSHAF_DATA,
  tajweedColored,
  theme,
  loadFont = true,
  highlightVerseKey = null,
  selection = null,
  recitationVerseKey = null,
  recitationWordLocation = null,
  practiceMode = false,
  practiceHideAyat = false,
  practiceRevealedLocations = EMPTY_LOCATIONS,
  practiceTargetWordLocation = null,
  practiceWrongFlashLocation = null,
  bookmarkedVerseKeys,
  onWordActivate,
  onWordPointerDown,
  onWordPointerUp,
  onWordPointerCancel,
  className,
  id,
  surahFilter,
}: MushafPageBlockProps) {
  const { t } = useTranslation("reader");
  return (
    <MushafPageView
      pageLayout={pageLayout}
      mushafData={mushafData}
      tajweedColored={tajweedColored}
      theme={theme}
      loadingMessage={t("loading")}
      loadFont={loadFont}
      highlightVerseKey={highlightVerseKey}
      selectedWordLocation={
        selection?.mode === "word" ? selection.word.location : null
      }
      activeVerseKey={
        selection?.mode === "ayah" ? selection.verseKey : recitationVerseKey
      }
      activeWordLocation={recitationWordLocation}
      practiceMode={practiceMode}
      hidePracticeWords={practiceHideAyat}
      revealedWordLocations={practiceRevealedLocations}
      practiceTargetWordLocation={practiceTargetWordLocation}
      incorrectWordLocation={practiceWrongFlashLocation}
      incorrectWordLabel={t("word.incorrect")}
      bookmarkedVerseKeys={bookmarkedVerseKeys}
      getSurahAccessibleLabel={(surahName) => `${t("surah")} ${surahName}`}
      onWordActivate={onWordActivate}
      onWordPointerDown={onWordPointerDown}
      onWordPointerUp={onWordPointerUp}
      onWordPointerCancel={onWordPointerCancel}
      className={className}
      id={id}
      surahFilter={surahFilter}
    />
  );
}
