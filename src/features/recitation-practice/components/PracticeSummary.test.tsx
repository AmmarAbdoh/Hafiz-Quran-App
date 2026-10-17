// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import type { MisreadWord } from "@/features/recitation-practice/contract";
import { PracticeSummary } from "./PracticeSummary";

const MISREAD: MisreadWord[] = [
  { location: "2:3:4", verseKey: "2:3", text: "ٱلْكِتَٰبُ" },
  { location: "2:5:1", verseKey: "2:5", text: "أُولَٰئِكَ" },
];

function renderSummary(
  overrides: Partial<Parameters<typeof PracticeSummary>[0]> = {},
) {
  const onPractiseAgain = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <LocaleProvider>
      <PracticeSummary
        open
        onOpenChange={onOpenChange}
        misreadWords={MISREAD}
        totalWords={15}
        onPractiseAgain={onPractiseAgain}
        {...overrides}
      />
    </LocaleProvider>,
  );
  return { onPractiseAgain, onOpenChange };
}

describe("after a recitation", () => {
  /**
   * The point of keeping every misread word: at the end the reader is told
   * which words to go back to, not just that something went wrong.
   */
  it("names each word that needs work and where it was", () => {
    renderSummary();

    expect(screen.getByText("ٱلْكِتَٰبُ")).toBeInTheDocument();
    expect(screen.getByText("آية ٢:٣")).toBeInTheDocument();
    expect(screen.getByText("أُولَٰئِكَ")).toBeInTheDocument();
    expect(screen.getByText("آية ٢:٥")).toBeInTheDocument();
  });

  it("counts them against the length of the page", () => {
    renderSummary();

    expect(
      screen.getByText("كلمتان تحتاجان مراجعة من ١٥."),
    ).toBeInTheDocument();
  });

  it("says plainly when nothing was misread", () => {
    renderSummary({ misreadWords: [] });

    expect(screen.getByText("تلاوة سليمة.")).toBeInTheDocument();
    expect(screen.getByText("لم تُخطئ في أي كلمة.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("starts another run without being closed first", () => {
    const { onPractiseAgain } = renderSummary();

    fireEvent.click(screen.getByRole("button", { name: "أعد التسميع" }));

    expect(onPractiseAgain).toHaveBeenCalledOnce();
  });

  it("shows nothing until a run has finished", () => {
    renderSummary({ open: false });

    expect(screen.queryByText("نتيجة التسميع")).not.toBeInTheDocument();
  });
});
