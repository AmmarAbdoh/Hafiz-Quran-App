// @vitest-environment jsdom

import { createInstance } from "i18next";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { QuizChoiceGrid } from "./QuizChoiceGrid";
import { QuizChoiceSearch } from "./QuizChoiceSearch";

const testI18n = createInstance();
void testI18n.init({
  lng: "en",
  fallbackLng: "en",
  defaultNS: "quiz",
  initAsync: false,
  resources: {
    en: {
      quiz: {
        results: { correct: "Correct", incorrect: "Incorrect" },
        search: {
          label: "Search",
          placeholder: "Type to search",
          results: "Search results",
          noResults: "No matching results",
          selected: "Selected",
          confirm: "Confirm selection",
        },
      },
    },
  },
});

function renderWithTranslations(node: React.ReactNode) {
  return render(<I18nextProvider i18n={testI18n}>{node}</I18nextProvider>);
}

describe("quiz choice interactions", () => {
  it("communicates correct and incorrect answers without relying on color", () => {
    renderWithTranslations(
      <QuizChoiceGrid
        choices={[
          { id: "wrong", label: "خاطئة" },
          { id: "correct", label: "صحيحة" },
        ]}
        selectedId="wrong"
        correctId="correct"
        disabled
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /خاطئة.*Incorrect/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /صحيحة.*Correct/ }),
    ).toBeDisabled();
  });

  /*
   * complete_ayah offers whole ayah continuations as options. line-clamp-3 cut
   * them off, so the learner could be asked to choose between texts they could
   * not finish reading - which makes the question unanswerable, not untidy.
   */
  it("shows a long option in full rather than truncating it", () => {
    const longAyah =
      "الحمد لله الذي أنزل على عبده الكتاب ولم يجعل له عوجا قيما لينذر بأسا شديدا من لدنه ويبشر المؤمنين الذين يعملون الصالحات أن لهم أجرا حسنا";

    const { container } = renderWithTranslations(
      <QuizChoiceGrid
        choices={[
          { id: "long", label: longAyah },
          { id: "short", label: "قصيرة" },
        ]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: longAyah })).toBeInTheDocument();
    expect(container.querySelector(".line-clamp-3")).toBeNull();
    // The grid scrolls instead, so a tall set of options cannot push the rest
    // of the question off the screen.
    expect(container.querySelector(".overflow-y-auto")).not.toBeNull();
  });

  it("supports keyboard selection in the searchable combobox", () => {
    const onConfirm = vi.fn();
    renderWithTranslations(
      <QuizChoiceSearch
        choices={[
          { id: "1:1", label: "بسم الله" },
          { id: "1:2", label: "الحمد لله" },
        ]}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("option", { name: "بسم الله" })).toBeVisible();
    expect(screen.getByRole("option", { name: "الحمد لله" })).toBeVisible();

    const input = screen.getByRole("combobox", { name: "Search" });
    fireEvent.change(input, { target: { value: "الحمد" } });
    expect(
      screen.getByRole("listbox", { name: "Search results" }),
    ).toBeVisible();
    const option = screen.getByRole("option", { name: "الحمد لله" });
    expect(option).toHaveAttribute("dir", "rtl");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Confirm selection" }));
    expect(onConfirm).toHaveBeenCalledWith("1:2");
  });
});
