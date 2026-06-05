import { useCallback, useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { FillBlankQuestion } from "@/features/quiz/components/FillBlankQuestion";
import { InfoQuestion } from "@/features/quiz/components/InfoQuestion";
import { pickRandomQuestionType } from "@/features/quiz/lib/question-utils";
import { getRandomVerse } from "@/shared/services/quran-data";
import type { QuestionType, QuizSelection, UthmaniVerse } from "@/shared/types/quran";

interface ActiveQuizProps {
  selection: QuizSelection;
  onBack: () => void;
}

export function ActiveQuiz({ selection, onBack }: ActiveQuizProps) {
  const [verse, setVerse] = useState<UthmaniVerse | null>(null);
  const [questionType, setQuestionType] = useState<QuestionType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchQuestion = useCallback(async () => {
    setLoading(true);
    const randomVerse = await getRandomVerse(
      selection.mode,
      selection.indices,
    );
    const type = pickRandomQuestionType(selection.questionTypes);
    setVerse(randomVerse);
    setQuestionType(type);
    setLoading(false);
  }, [selection]);

  useEffect(() => {
    fetchQuestion();
  }, [fetchQuestion]);

  if (loading || !verse || !questionType) {
    return <div className="text-center py-8">تحميل...</div>;
  }

  return (
    <div className="space-y-4">
      {questionType === "fill_blank" ? (
        <FillBlankQuestion verse={verse} onNext={fetchQuestion} />
      ) : (
        <InfoQuestion
          verse={verse}
          questionType={questionType}
          onNext={fetchQuestion}
        />
      )}
      <div className="text-center">
        <Button variant="outline" onClick={onBack}>
          عودة للإعدادات
        </Button>
      </div>
    </div>
  );
}
