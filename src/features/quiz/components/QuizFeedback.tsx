import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { VerseMetadata, getVerseInfo, useSurahNames } from "@/domain/quran";
import type { MushafVerse, VerseInfoRecord } from "@/domain/quran";
import { buildAnswerExplanation } from "../model/questionExplanation";
import type { QuizQuestion } from "../model/types";
import { QuizAnswerExplanation } from "./QuizAnswerExplanation";
import { QuizMushafPreview } from "./QuizMushafPreview";

interface QuizFeedbackProps {
  isCorrect: boolean;
  question: QuizQuestion;
  selectedChoiceId: string;
  verseInfoRecords: VerseInfoRecord[];
  mushafData: MushafVerse[];
  streak: number;
  /** Off when the question itself already shows the answered ayah on the page. */
  showMushaf?: boolean;
  onNext: () => void;
}

export function QuizFeedback({
  isCorrect,
  question,
  selectedChoiceId,
  verseInfoRecords,
  mushafData,
  streak,
  showMushaf = true,
  onNext,
}: QuizFeedbackProps) {
  const { t } = useTranslation("quiz");
  const { surahName } = useSurahNames();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const explanation = buildAnswerExplanation({
    question,
    selectedChoiceId,
    mushafData,
    verseInfoRecords,
    surahName,
  });
  // Review the ayah that was actually asked about, which is not always the
  // verse the prompt was built around.
  const testedVerse =
    mushafData.find(
      (verse) =>
        verse.sura_no === explanation.surahNumber &&
        verse.aya_no === explanation.ayahNumber,
    ) ?? question.verse;
  const verseInfo = getVerseInfo(testedVerse.id, verseInfoRecords);

  useEffect(() => {
    headingRef.current?.focus();
  }, [question.id]);

  return (
    <section className="mt-6 space-y-4" aria-labelledby="quiz-feedback-heading">
      <div role="status" aria-live="polite" aria-atomic="true">
        <h3
          id="quiz-feedback-heading"
          ref={headingRef}
          tabIndex={-1}
          className="sr-only"
        >
          {isCorrect
            ? t("feedback.correctAnnouncement")
            : t("feedback.incorrectAnnouncement", {
                answer: explanation.correctLabel,
              })}
        </h3>
        <div
          className="flex flex-wrap items-center justify-center gap-2"
          aria-hidden="true"
        >
          <Badge
            variant={isCorrect ? "success" : "destructive"}
            className="px-4 py-1 text-base"
          >
            {isCorrect ? t("feedback.correct") : t("feedback.incorrect")}
          </Badge>
          {isCorrect && streak > 1 && (
            <Badge variant="secondary">
              {t("feedback.streak", { count: streak })}
            </Badge>
          )}
        </div>
      </div>

      <QuizAnswerExplanation explanation={explanation} isCorrect={isCorrect} />

      {showMushaf && (
        <QuizMushafPreview
          page={testedVerse.page}
          mushafData={mushafData}
          surahFilter={testedVerse.sura_no}
          highlightVerseKey={explanation.verseKey}
        />
      )}
      <VerseMetadata items={verseInfo} />

      <div className="flex justify-center">
        <Button size="lg" onClick={onNext}>
          {t("feedback.next")}
        </Button>
      </div>
    </section>
  );
}
