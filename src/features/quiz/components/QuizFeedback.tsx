import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { VerseMetadata } from "@/shared/components/VerseMetadata";
import { QuizMushafPreview } from "@/features/quiz/components/QuizMushafPreview";
import { getVerseInfo } from "@/shared/services/quran-data";
import type {
  MushafVerse,
  MushafWordLayoutData,
  VerseInfoRecord,
} from "@/shared/types/quran";

interface QuizFeedbackProps {
  isCorrect: boolean;
  verse: MushafVerse;
  verseInfoRecords: VerseInfoRecord[];
  mushafData: MushafVerse[];
  wordLayout: MushafWordLayoutData;
  streak: number;
  onNext: () => void;
  nextLabel?: string;
}

export function QuizFeedback({
  isCorrect,
  verse,
  verseInfoRecords,
  mushafData,
  wordLayout,
  streak,
  onNext,
  nextLabel = "السؤال التالي",
}: QuizFeedbackProps) {
  const verseInfo = getVerseInfo(verse.id, verseInfoRecords);
  const verseKey = `${verse.sura_no}:${verse.aya_no}`;

  return (
    <div className="mt-8 space-y-5 text-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge
          variant={isCorrect ? "success" : "destructive"}
          className="px-4 py-1 text-base"
        >
          {isCorrect ? "صحيح! بارك الله فيك!" : "إجابة خاطئة."}
        </Badge>
        {isCorrect && streak > 1 && (
          <Badge variant="secondary">سلسلة {streak} ✨</Badge>
        )}
      </div>

      <QuizMushafPreview
        page={verse.page}
        mushafData={mushafData}
        wordLayout={wordLayout}
        highlightVerseKey={verseKey}
      />

      <VerseMetadata items={verseInfo} />

      <Button size="lg" onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}
