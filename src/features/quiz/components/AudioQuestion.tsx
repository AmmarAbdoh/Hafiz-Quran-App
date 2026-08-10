import { Loader2, RotateCcw, TriangleAlert, Volume2 } from "lucide-react";
import { QuizChoiceGrid } from "@/features/quiz/components/QuizChoiceGrid";
import { QuizFeedback } from "@/features/quiz/components/QuizFeedback";
import { QuizMushafPreview } from "@/features/quiz/components/QuizMushafPreview";
import { useAyahAudio } from "@/features/quiz/hooks/useAyahAudio";
import type { AudioIdentifyQuizQuestion } from "@/features/quiz/lib/quiz-types";
import { getAyahAudioUrl } from "@/shared/constants/audio";
import { useReciter } from "@/shared/hooks/use-reciter";
import { Button } from "@/shared/components/ui/button";
import type {
  MushafVerse,
  MushafWordLayoutData,
  VerseInfoRecord,
} from "@/shared/types/quran";

interface AudioQuestionProps {
  question: AudioIdentifyQuizQuestion;
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

export function AudioQuestion({
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
}: AudioQuestionProps) {
  const { reciter } = useReciter();
  const audioUrl = getAyahAudioUrl(
    reciter,
    question.verse.sura_no,
    question.verse.aya_no,
  );
  const { status, play } = useAyahAudio(audioUrl);

  const prompt =
    question.audioPrompt === "surah"
      ? "استمع للآية وحدد اسم السورة:"
      : "استمع للآية وحدد الآية التالية:";

  return (
    <div className="space-y-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-xl border bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">{prompt}</p>

        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={play}
        >
          {status === "loading" && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          )}
          {status === "playing" && (
            <Volume2 className="h-4 w-4 animate-pulse text-primary" aria-hidden />
          )}
          {status === "idle" && <Volume2 className="h-4 w-4" aria-hidden />}
          {status === "error" && <RotateCcw className="h-4 w-4" aria-hidden />}
          {status === "loading" && "جاري التحميل…"}
          {status === "playing" && "إعادة من البداية"}
          {status === "idle" && "استمع للآية"}
          {status === "error" && "إعادة المحاولة"}
        </Button>

        {status === "error" && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
            تعذر تشغيل الصوت، تحقق من الاتصال وحاول مجدداً.
          </p>
        )}

        {answered && (
          <QuizMushafPreview
            page={question.verse.page}
            mushafData={mushafData}
            wordLayout={wordLayout}
            highlightVerseKey={question.verseKey}
          />
        )}
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
