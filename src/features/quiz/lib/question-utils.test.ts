import { describe, it, expect } from "vitest";
import {
  checkFillBlankAnswer,
  checkInfoAnswer,
  generateHiddenIndex,
  isJuzNameDisabled,
  isSurahNameDisabled,
  pickRandomQuestionType,
} from "./question-utils";

describe("question-utils", () => {
  it("disables surah name when single surah selected", () => {
    expect(isSurahNameDisabled("surah", [1])).toBe(true);
    expect(isSurahNameDisabled("surah", [1, 2])).toBe(false);
  });

  it("disables juz number when single juz selected", () => {
    expect(isJuzNameDisabled("juz", [1])).toBe(true);
    expect(isJuzNameDisabled("juz", [1, 2])).toBe(false);
  });

  it("picks from available question types", () => {
    const type = pickRandomQuestionType(["fill_blank", "ayah_number"]);
    expect(["fill_blank", "ayah_number"]).toContain(type);
  });

  it("generates valid hidden index", () => {
    const index = generateHiddenIndex(true, true, true);
    expect([0, 1, 2]).toContain(index);
  });

  it("checks fill blank answers", () => {
    expect(checkFillBlankAnswer("بسم الله", "بسم الله")).toBe(true);
    expect(checkFillBlankAnswer("wrong", "بسم الله")).toBe(false);
  });

  it("checks info answers", () => {
    expect(checkInfoAnswer("5", 5)).toBe(true);
    expect(checkInfoAnswer("3", 5)).toBe(false);
  });
});
