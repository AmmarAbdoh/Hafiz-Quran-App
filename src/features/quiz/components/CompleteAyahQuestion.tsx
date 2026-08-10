import { QuizChoiceGrid } from "@/features/quiz/components/QuizChoiceGrid";
import { QuizFeedback } from "@/features/quiz/components/QuizFeedback";
import { QuizMushafPreview } from "@/features/quiz/components/QuizMushafPreview";
import type { CompleteAyahQuizQuestion } from "@/features/quiz/lib/quiz-types";
import type {
  MushafVerse,
  MushafWordLayoutData,
  VerseInfoRecord,
} from "@/shared/types/quran";

interface CompleteAyahQuestionProps {
  question: CompleteAyahQuizQuestion;
  mushafData: MushafVerse[];
  wordLayout: MushafWordLayoutData;
  verseInfoRecords: VerseInfoRecord[];
  answered: boolean;
  isCorrect: boolean | null;
  selectedChoiceId: string | null;
  streak: number;
  onSubmit: (choiceId: string) => void;
  onNext: () => void;
}

export function CompleteAyahQuestion({
  question,
  mushafData,
  wordLayout,
  verseInfoRecords,
  answered,
  isCorrect,
  selectedChoiceId,
  streak,
  onSubmit,
  onNext,
}: CompleteAyahQuestionProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">أكمل الآية:</p>
        <QuizMushafPreview
          page={question.verse.page}
          mushafData={mushafData}
          wordLayout={wordLayout}
          highlightVerseKey={question.verseKey}
        />
        <p className="quran-text font-mushaf text-lg leading-loose text-muted-foreground">
          {question.promptText} …
        </p>
      </div>

      <QuizChoiceGrid
        choices={question.choices}
        selectedId={selectedChoiceId}
        correctId={answered ? question.correctChoiceId : null}
        disabled={answered}
        onSelect={onSubmit}
      />

      {answered && isCorrect !== null && (
        <QuizFeedback
          isCorrect={isCorrect}
          verse={question.verse}
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
