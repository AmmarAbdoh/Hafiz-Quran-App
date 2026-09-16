import { ArrowUpRight, Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { buildQuranAyahPath } from "@/features/quran-reader";
import { useQuizFormatters } from "../hooks/useQuizFormatters";
import type { AnswerExplanation } from "../model/questionExplanation";
import { QuizAnswerLabel } from "./QuizAnswerLabel";

interface QuizAnswerExplanationProps {
  explanation: AnswerExplanation;
  isCorrect: boolean;
  /** True when the answers are mushaf text rather than interface text. */
  quranScript?: boolean;
}

/**
 * Names the correct answer, repeats what was chosen when it differs, and states
 * the fact that settles it. Highlighting a button is not an explanation.
 */
export function QuizAnswerExplanation({
  explanation,
  isCorrect,
  quranScript = false,
}: QuizAnswerExplanationProps) {
  const { t } = useTranslation("quiz");
  const { formatNumber } = useQuizFormatters();
  const { facts, detailKey } = explanation;
  const detailText = detailKey
    ? t(detailKey, {
        surah: facts.surah,
        ayah: formatNumber(facts.ayah),
        page: formatNumber(facts.page),
        juz: formatNumber(facts.juz),
        total: formatNumber(facts.totalAyahs),
        hizb: facts.hizb === null ? "" : formatNumber(facts.hizb),
      })
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 rounded-xl border border-border bg-card p-4 text-start">
      <div className="space-y-2">
        <p className="flex items-start gap-2 text-sm">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <span>
            <span className="font-semibold">{t("feedback.correctAnswer")}</span>{" "}
            <QuizAnswerLabel
              label={explanation.correctLabel}
              quranScript={quranScript}
            />
          </span>
        </p>
        {!isCorrect && (
          <p className="flex items-start gap-2 text-sm">
            <X
              className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              aria-hidden
            />
            <span>
              <span className="font-semibold">{t("feedback.yourAnswer")}</span>{" "}
              <QuizAnswerLabel
                label={explanation.selectedLabel}
                quranScript={quranScript}
              />
            </span>
          </p>
        )}
      </div>

      {detailText && (
        <p className="text-sm text-muted-foreground">{detailText}</p>
      )}

      <Link
        to={buildQuranAyahPath(explanation.surahNumber, explanation.ayahNumber)}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        {t("feedback.openInMushaf")}
        <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
      </Link>
    </div>
  );
}
