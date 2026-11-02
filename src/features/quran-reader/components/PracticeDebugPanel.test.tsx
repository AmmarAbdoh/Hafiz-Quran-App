// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "@/app/i18n";
import type * as Practice from "@/features/recitation-practice";
import type { RecitationPracticeTelemetry } from "@/features/recitation-practice/contract";
import { phonemesAsLetters } from "@/features/recitation-practice/model/phonemeText";
import { initialRecitationPracticeTelemetry } from "@/features/recitation-practice/model/practiceState";

const telemetry = vi.hoisted(() => ({
  current: undefined as unknown as RecitationPracticeTelemetry,
}));

vi.mock("@/features/recitation-practice", async (importOriginal) => {
  const actual = await importOriginal<typeof Practice>();
  return {
    PRACTICE_SAMPLE_RATE: actual.PRACTICE_SAMPLE_RATE,
    phonemesAsLetters: actual.phonemesAsLetters,
    useRecitationPracticeTelemetry: () => telemetry.current,
  };
});

import { PracticeDebugPanel } from "./PracticeDebugPanel";

const heard = (symbol: string, endsWord = false, confidence = 0.9) => ({
  symbol,
  confidence,
  endsWord,
});

describe("the debug readout", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows what was heard as words, split where the cursor moved on", () => {
    telemetry.current = {
      ...initialRecitationPracticeTelemetry,
      /* ٱلْحَمْدُ لِلَّهِ, as the model emits it. */
      heard: [
        heard("ءَ"),
        heard("ل"),
        heard("حَ"),
        heard("م"),
        heard("دُ", true),
        heard("لِ"),
        heard("للَ"),
        heard("اا"),
        heard("هِ", true),
      ],
      expected: ["رَ", "ب", "بِ"],
    };

    render(
      <LocaleProvider>
        <PracticeDebugPanel />
      </LocaleProvider>,
    );

    const words = screen.getByText(
      (_, element) =>
        element?.getAttribute("dir") === "rtl" &&
        element.textContent?.startsWith("ءَ") === true,
    );
    expect(words.textContent?.trim()).toBe(
      [
        phonemesAsLetters(["ءَ", "ل", "حَ", "م", "دُ"]),
        phonemesAsLetters(["لِ", "للَ", "اا", "هِ"]),
      ].join(" "),
    );
    /* The model's own symbol is still there, for how long a madd was held. */
    expect(screen.getByTitle("اا · 90%")).toBeTruthy();
    expect(screen.getByText(phonemesAsLetters(["رَ", "ب", "بِ"]))).toBeTruthy();
  });

  it("dims a sound the model doubted", () => {
    telemetry.current = {
      ...initialRecitationPracticeTelemetry,
      heard: [heard("بِ"), heard("س", false, 0.2), heard("مِ", true)],
    };

    render(
      <LocaleProvider>
        <PracticeDebugPanel />
      </LocaleProvider>,
    );

    expect(screen.getByTitle("س · 20%").className).toContain(
      "text-muted-foreground",
    );
  });
});
