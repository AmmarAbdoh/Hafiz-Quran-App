import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateHiddenIndex,
  getDefaultQuestionTypes,
  isQuestionTypeDisabled,
  pickRandomQuestionType,
} from "./questionTypes";

describe("quiz question type rules", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("disables labels that would reveal a single-scope answer", () => {
    expect(
      isQuestionTypeDisabled("surah_name", {
        mode: "surah",
        surahIndices: [1],
      }),
    ).toBe(true);
    expect(
      isQuestionTypeDisabled("juz_number", {
        mode: "juz",
        juzIndices: [1],
      }),
    ).toBe(true);
  });

  it("returns only available default types", () => {
    const types = getDefaultQuestionTypes({
      mode: "surah",
      surahIndices: [1],
    });
    expect(types).not.toContain("surah_name");
    expect(types).toContain("fill_blank");
  });

  it("keeps revealing labels when a scope contains multiple selections", () => {
    expect(
      isQuestionTypeDisabled("surah_name", {
        mode: "surah",
        surahIndices: [1, 2],
      }),
    ).toBe(false);
    expect(
      isQuestionTypeDisabled("juz_number", {
        mode: "juz",
        juzIndices: [1, 2],
      }),
    ).toBe(false);
    expect(isQuestionTypeDisabled("surah_name", { mode: "surah" })).toBe(false);
    expect(isQuestionTypeDisabled("page_number", { mode: "page" })).toBe(false);
  });

  it("selects only supplied question and blank positions", () => {
    expect(["fill_blank", "ayah_number"]).toContain(
      pickRandomQuestionType(["fill_blank", "ayah_number"]),
    );
    expect([0, 1, 2]).toContain(generateHiddenIndex(true, true, true));
  });

  it("handles empty question lists and unavailable blank positions", () => {
    expect(pickRandomQuestionType([])).toBeNull();
    expect(generateHiddenIndex(false, false, false)).toBe(1);
  });

  it("maps deterministic random values to the available options", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(pickRandomQuestionType(["fill_blank", "page_number"])).toBe(
      "page_number",
    );
    expect(generateHiddenIndex(true, false, true)).toBe(2);
  });
});
