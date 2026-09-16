// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import type { MushafVerse } from "@/domain/quran";
import type { QuizScope } from "../model/types";
import { QuizScopeStep } from "./QuizScopeStep";

function makeVerse(surah: number, ayah: number, page: number): MushafVerse {
  return {
    id: surah * 1000 + ayah,
    jozz: 1,
    page,
    sura_no: surah,
    sura_name_en: "Al-Baqarah",
    sura_name_ar: "البقرة",
    line_start: 1,
    line_end: 1,
    aya_no: ayah,
    aya_text: "آية",
    aya_text_emlaey: "اية",
  };
}

const mushafData = [makeVerse(1, 1, 1), makeVerse(2, 1, 2), makeVerse(2, 2, 3)];

const scope: QuizScope = { mode: "surah", surahIndices: [1] };

function renderStep(initialScope: QuizScope = scope) {
  const onValidityChange = vi.fn();
  const onScopeChange = vi.fn();
  render(
    <LocaleProvider>
      <QuizScopeStep
        mushafData={mushafData}
        scope={initialScope}
        ayahCount={1}
        onValidityChange={onValidityChange}
        onScopeChange={onScopeChange}
        onNext={vi.fn()}
      />
    </LocaleProvider>,
  );
  return { onValidityChange, onScopeChange };
}

describe("QuizScopeStep", () => {
  beforeEach(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    window.localStorage.setItem("artqiy.locale", "ar");
  });

  it("starts out valid", () => {
    const { onValidityChange } = renderStep();
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  /*
   * The scope is only committed upward while it is valid, so an invalid draft
   * leaves the page holding the previous one. Continue is disabled for that
   * reason; the step nav above it was not, and could walk straight past it to
   * a quiz built on a scope the learner was no longer looking at.
   */
  it("reports a scope it cannot commit, so the step nav can be held back", () => {
    // A page range with no pages in it: what an emptied page field leaves.
    const { onValidityChange, onScopeChange } = renderStep({ mode: "page" });

    expect(onValidityChange).toHaveBeenLastCalledWith(false);
    expect(onScopeChange).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /متابعة إلى أنواع الأسئلة/ }),
    ).toBeDisabled();
  });

  it("names what is wrong rather than only refusing", () => {
    renderStep({ mode: "page" });
    expect(screen.getByRole("alert")).toHaveTextContent(/صفحات/);
  });

  /*
   * Both page fields obey one rule, so there is one message and both point at
   * it. Rendering a copy under each field announced the same sentence three
   * times over for one mistake.
   */
  it("ties the one error to both fields that caused it", () => {
    renderStep({ mode: "page" });

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(1);
    const errorId = alerts[0]!.id;

    for (const id of ["quiz-page-from", "quiz-page-to"]) {
      const input = document.querySelector<HTMLInputElement>(`#${id}`);
      expect(input).not.toBeNull();
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input!.getAttribute("aria-describedby")).toContain(errorId);
    }
  });

  it("frees the nav again once the scope can be committed", () => {
    const { onValidityChange } = renderStep({ mode: "page" });
    expect(onValidityChange).toHaveBeenLastCalledWith(false);

    const from = document.querySelector<HTMLInputElement>("#quiz-page-from");
    const to = document.querySelector<HTMLInputElement>("#quiz-page-to");
    expect(from).not.toBeNull();

    fireEvent.change(from!, { target: { value: "2" } });
    fireEvent.change(to!, { target: { value: "3" } });

    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });
});
