import { describe, expect, it } from "vitest";
import {
  generateHiddenIndex,
  getDefaultQuestionTypes,
  isJuzNameDisabled,
  isSurahNameDisabled,
  pickRandomQuestionType,
} from "@/features/quiz/lib/question-utils";

describe("question-utils", () => {
  it("disables surah name when single surah selected", () => {
    expect(isSurahNameDisabled({ mode: "surah", surahIndices: [1] })).toBe(
      true,
    );
    expect(isSurahNameDisabled({ mode: "surah", surahIndices: [1, 2] })).toBe(
      false,
    );
  });

  it("disables juz number when single juz selected", () => {
    expect(isJuzNameDisabled({ mode: "juz", juzIndices: [1] })).toBe(true);
    expect(isJuzNameDisabled({ mode: "juz", juzIndices: [1, 2] })).toBe(false);
  });

  it("picks from available question types", () => {
    const type = pickRandomQuestionType(["fill_blank", "ayah_number"]);
    expect(["fill_blank", "ayah_number"]).toContain(type);
  });

  it("generates valid hidden index", () => {
    const index = generateHiddenIndex(true, true, true);
    expect([0, 1, 2]).toContain(index);
  });

  it("returns default types without disabled ones", () => {
    const types = getDefaultQuestionTypes({
      mode: "surah",
      surahIndices: [1],
    });
    expect(types).not.toContain("surah_name");
    expect(types).toContain("fill_blank");
  });
});
