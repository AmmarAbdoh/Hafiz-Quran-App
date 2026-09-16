// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import { ThemeProvider } from "@/shared/hooks/use-theme";
import type { MushafVerse } from "@/domain/quran";
import type { InfoQuizQuestion } from "../model/types";
import { ActiveQuiz } from "./ActiveQuiz";

// The ayah preview needs the Quran data provider and the loaded mushaf; this
// is about the question heading and the exit guard, not about rendering pages.
vi.mock("./QuizMushafPreview", () => ({
  QuizMushafPreview: () => null,
}));

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

const question: InfoQuizQuestion = {
  id: "q1",
  type: "juz_number",
  verse,
  verseKey: "2:10",
  testedVerseKey: "2:10",
  choices: [
    { id: "1", label: "١" },
    { id: "2", label: "٢" },
  ],
  correctChoiceId: "1",
};

function renderActiveQuiz(overrides: Record<string, unknown> = {}) {
  const onExit = vi.fn();
  const onFinish = vi.fn();
  const engine = {
    currentQuestion: question,
    error: null,
    phase: "active",
    answered: false,
    lastIsCorrect: null,
    lastSelectedChoiceId: null,
    streak: 0,
    progress: { current: 1, total: 5 },
    score: { correct: 0, total: 0 },
    answers: [],
    submitAnswer: vi.fn(),
    goToNextQuestion: vi.fn(),
    ...overrides,
  };

  render(
    <LocaleProvider>
      <ThemeProvider>
        <ActiveQuiz
          engine={engine as never}
          mushafData={[verse]}
          verseInfoRecords={[]}
          onFinish={onFinish}
          onExit={onExit}
        />
      </ThemeProvider>
    </LocaleProvider>,
  );
  return { onExit, onFinish };
}

describe("ActiveQuiz", () => {
  /*
   * The heading was sr-only and held the progress, which the header already
   * states. The question itself was the smallest, most muted line on the
   * screen, so a sighted learner had no heading at all.
   */
  it("shows the question as the section's heading", () => {
    renderActiveQuiz();

    const heading = screen.getByRole("heading", {
      name: "في أي جزء تقع هذه الآية؟",
    });
    expect(heading).toBeInTheDocument();
    expect(heading).not.toHaveClass("sr-only");
  });

  /*
   * Leaving throws the session away, and its button sits a few millimetres
   * from the one that saves it.
   */
  it("asks before throwing the session away", () => {
    const { onExit } = renderActiveQuiz();

    fireEvent.click(screen.getByRole("button", { name: "الخروج من الاختبار" }));

    expect(onExit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "إنهاء الجلسة دون حفظ؟" }),
    ).toBeInTheDocument();
  });

  it("leaves only once that is confirmed", () => {
    const { onExit } = renderActiveQuiz();

    fireEvent.click(screen.getByRole("button", { name: "الخروج من الاختبار" }));
    fireEvent.click(screen.getByRole("button", { name: "اخرج دون حفظ" }));

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("keeps the session when the learner backs out", () => {
    const { onExit } = renderActiveQuiz();

    fireEvent.click(screen.getByRole("button", { name: "الخروج من الاختبار" }));
    fireEvent.click(screen.getByRole("button", { name: "تابع الاختبار" }));

    expect(onExit).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "إنهاء الجلسة دون حفظ؟" }),
    ).not.toBeInTheDocument();
  });

  it("finishing still saves without asking", () => {
    const { onFinish } = renderActiveQuiz();

    fireEvent.click(screen.getByRole("button", { name: "إنهاء الاختبار" }));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
