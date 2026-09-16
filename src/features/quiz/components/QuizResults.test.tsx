// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import type { MushafVerse } from "@/domain/quran";
import type { QuizAnswerRecord, QuizSessionSummaryV3 } from "../model/types";
import { QuizResults } from "./QuizResults";

vi.mock("./QuizMushafPreview", () => ({ QuizMushafPreview: () => null }));

const verse: MushafVerse = {
  id: 2010,
  jozz: 1,
  page: 2,
  sura_no: 2,
  sura_name_en: "Al-Baqarah",
  sura_name_ar: "البقرة",
  line_start: 1,
  line_end: 1,
  aya_no: 10,
  aya_text: "آية",
  aya_text_emlaey: "اية",
};

function makeAnswer(isCorrect: boolean, index: number): QuizAnswerRecord {
  return {
    questionId: `q${index}`,
    questionType: "juz_number",
    verseKey: "2:10",
    testedVerseKey: "2:10",
    selectedChoiceId: isCorrect ? "1" : "2",
    selectedLabel: isCorrect ? "١" : "٢",
    correctChoiceId: "1",
    correctLabel: "١",
    isCorrect,
  };
}

const answers = [makeAnswer(true, 0), makeAnswer(false, 1)];

const summary: QuizSessionSummaryV3 = {
  schemaVersion: 3,
  id: "s1",
  completedAt: new Date().toISOString(),
  scope: null,
  sessionMode: "fixed",
  questionCount: 2,
  correctCount: 1,
  accuracyByType: { juz_number: { correct: 1, total: 2 } },
  durationMs: 30_000,
  answers: [],
};

function renderResults() {
  const onReviewMistakes = vi.fn();
  render(
    <LocaleProvider>
      <QuizResults
        summary={summary}
        answers={answers}
        mushafData={[verse]}
        historySaveFailed={false}
        onRetry={vi.fn()}
        onReviewMistakes={onReviewMistakes}
        onNewSetup={vi.fn()}
      />
    </LocaleProvider>,
  );
  return { onReviewMistakes };
}

describe("QuizResults", () => {
  beforeEach(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    window.localStorage.setItem("artqiy.locale", "ar");
  });

  /*
   * Reviewing the misses is the reason to have them. It used to be the
   * secondary button beside a primary "retry the same session".
   */
  it("leads with reviewing what was missed", () => {
    renderResults();

    const review = screen.getByRole("button", { name: /راجع/ });
    const retry = screen.getByRole("button", { name: "إعادة الاختبار" });

    // The primary is the filled one; the fallback is outlined.
    expect(review.className).toContain("bg-primary");
    expect(retry.className).not.toContain("bg-primary");
  });

  /*
   * Every row carried an aria-hidden tick or cross and, at its far end, a
   * badge saying the same thing in words.
   */
  it("states each verdict once", () => {
    renderResults();

    const rows = screen.getAllByRole("button", { expanded: false });
    const first = rows[0]!;

    expect(within(first).getAllByText("صحيح")).toHaveLength(1);
    // Still reaches a screen reader, which the icon alone did not.
    expect(within(first).getByText("صحيح")).toHaveClass("sr-only");
  });

  it("shows accuracy per question type as a proportion", () => {
    renderResults();

    // 1 of 2 - the numbers are the accessible form of the bar beside them.
    // Scoped to the per-type list: the overall score is also 50%.
    const accuracy = screen.getByRole("region", { name: "دقة الإجابات" });
    expect(within(accuracy).getByText(/١\/٢/)).toBeInTheDocument();
    expect(within(accuracy).getByText(/٥٠٪/)).toBeInTheDocument();
  });
});
