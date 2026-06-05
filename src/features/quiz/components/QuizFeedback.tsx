import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { VerseMetadata } from "@/shared/components/VerseMetadata";
import type { VerseInfoItem } from "@/shared/types/quran";

interface QuizFeedbackProps {
  isCorrect: boolean;
  verseInfo: VerseInfoItem[];
  onNext: () => void;
}

export function QuizFeedback({
  isCorrect,
  verseInfo,
  onNext,
}: QuizFeedbackProps) {
  return (
    <div className="mt-8 space-y-4 text-center">
      <Badge variant={isCorrect ? "success" : "destructive"} className="text-base px-4 py-1">
        {isCorrect ? "صحيح! بارك الله فيك!" : "إجابة خاطئة."}
      </Badge>
      <VerseMetadata items={verseInfo} />
      <Button size="lg" onClick={onNext}>
        السؤال التالي
      </Button>
    </div>
  );
}
