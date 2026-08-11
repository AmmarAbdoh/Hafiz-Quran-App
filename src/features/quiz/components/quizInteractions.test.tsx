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
