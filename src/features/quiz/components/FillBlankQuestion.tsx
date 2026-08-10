import { useMemo } from "react";
import { QuizChoiceSearch } from "@/features/quiz/components/QuizChoiceSearch";
import { QuizFeedback } from "@/features/quiz/components/QuizFeedback";
import { QuizMushafPreview } from "@/features/quiz/components/QuizMushafPreview";
import type { FillBlankQuizQuestion } from "@/features/quiz/lib/quiz-types";
import type {
  MushafVerse,
  MushafWordLayoutData,
  VerseInfoRecord,
} from "@/shared/types/quran";

interface FillBlankQuestionProps {
  question: FillBlankQuizQuestion;
  mushafData: MushafVerse[];
  wordLayout: MushafWordLayoutData;
  verseInfoRecords: VerseInfoRecord[];
  answered: boolean;
  isCorrect: boolean | null;
  streak: number;
  onSubmit: (choiceId: string) => void;
  onNext: () => void;
}

export function FillBlankQuestion({
  question,
  mushafData,
  wordLayout,
  verseInfoRecords,
  answered,
  isCorrect,
  streak,
  onSubmit,
  onNext,
}: FillBlankQuestionProps) {
  const highlightVerseKey = answered ? question.hiddenVerseKey : null;
  const hiddenVerseKey = answered ? null : question.hiddenVerseKey;

  const prompt = useMemo(
    () => "اختر الآية المخفية في المصحف:",
    [],
  );

  return (
    <div className="space-y-6">
      <p className="text-center text-sm text-muted-foreground">{prompt}</p>

      <QuizMushafPreview
        page={question.page}
        mushafData={mushafData}
        wordLayout={wordLayout}
        highlightVerseKey={highlightVerseKey}
        hiddenVerseKey={hiddenVerseKey}
      />

      {!answered && (
        <QuizChoiceSearch
          choices={question.searchOptions}
          onConfirm={onSubmit}
        />
      )}

      {answered && isCorrect !== null && (
        <QuizFeedback
          isCorrect={isCorrect}
          verse={question.hiddenVerse}
          verseInfoRecords={verseInfoRecords}
          mushafData={mushafData}
          wordLayout={wordLayout}
          streak={streak}
          onNext={onNext}
        />
      )}
    </div>
  );
}
