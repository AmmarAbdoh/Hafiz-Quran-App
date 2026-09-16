import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateHiddenIndex,
  getAvailableQuestionTypes,
  getPresetQuestionTypes,
  keepSupportedQuestionTypes,
  matchesPreset,
  pickQuestionType,
} from "./questionTypes";
import type { ScopeCoverage } from "./scopeCoverage";

const wideCoverage: ScopeCoverage = {
  ayahCount: 120,
  surahNumbers: [1, 2, 3],
  juzNumbers: [1, 2],
  hizbNumbers: [1, 2, 3],
  pageNumbers: [1, 2, 3, 4],
};

const singleSurahCoverage: ScopeCoverage = {
  ayahCount: 7,
  surahNumbers: [1],
  juzNumbers: [1],
  hizbNumbers: [1],
  pageNumbers: [1],
};

describe("quiz question type rules", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /*
   * Changing scope used to discard the whole selection, and it runs on every
   * keystroke in a page or ayah field - typing "127" wiped a deliberate set
   * three times over before the learner had finished the number.
   */
  describe("narrowing a selection to a new scope", () => {
    it("keeps the types the new scope still supports", () => {
      expect(
        keepSupportedQuestionTypes(
          ["fill_blank", "complete_ayah", "surah_name"],
          singleSurahCoverage,
        ),
      ).toEqual(["fill_blank", "complete_ayah"]);
    });

    it("keeps a deliberate choice untouched when it all still works", () => {
      const chosen = ["fill_blank", "surah_name"] as const;
      expect(keepSupportedQuestionTypes([...chosen], wideCoverage)).toEqual([
        ...chosen,
      ]);
    });

    it("falls back to the preset only when nothing survives", () => {
      expect(
        keepSupportedQuestionTypes(["surah_name"], singleSurahCoverage),
      ).toBeNull();
    });

    it("leaves an unmade choice unmade", () => {
      expect(keepSupportedQuestionTypes(null, wideCoverage)).toBeNull();
    });
  });

  it("keeps every type for a scope that spans several surahs, juz and pages", () => {
    expect(getAvailableQuestionTypes(wideCoverage)).toHaveLength(8);
  });

  it("drops location types whose answer the scope gives away", () => {
    const available = getAvailableQuestionTypes(singleSurahCoverage);

    expect(available).not.toContain("surah_name");
    expect(available).not.toContain("juz_number");
    expect(available).not.toContain("page_number");
    expect(available).toContain("complete_ayah");
    expect(available).toContain("ayah_number");
  });

  it("builds presets from what the scope supports", () => {
    expect(getPresetQuestionTypes("starter", wideCoverage)).toEqual([
      "complete_ayah",
      "fill_blank",
    ]);
    expect(
      getPresetQuestionTypes("standard", singleSurahCoverage),
    ).not.toContain("surah_name");
    expect(
      matchesPreset(["complete_ayah", "fill_blank"], "starter", wideCoverage),
    ).toBe(true);
    expect(matchesPreset(["complete_ayah"], "starter", wideCoverage)).toBe(
      false,
    );
  });

  it("narrows a preset to the types a tiny scope can support", () => {
    const tinyCoverage: ScopeCoverage = {
      ayahCount: 3,
      surahNumbers: [112],
      juzNumbers: [30],
      hizbNumbers: [60],
      pageNumbers: [604],
    };

    expect(getPresetQuestionTypes("starter", tinyCoverage)).toEqual([
      "fill_blank",
    ]);
  });

  it("still returns something playable when a preset has nothing available", () => {
    const recallLessCoverage: ScopeCoverage = {
      ayahCount: 1,
      surahNumbers: [112, 113],
      juzNumbers: [30],
      hizbNumbers: [60],
      pageNumbers: [604, 605],
    };

    expect(getPresetQuestionTypes("starter", recallLessCoverage)).toEqual([
      "surah_name",
      "page_number",
    ]);
  });

  it("avoids repeating the previous question type", () => {
    expect(pickQuestionType(["fill_blank", "ayah_number"], "fill_blank")).toBe(
      "ayah_number",
    );
    expect(pickQuestionType(["fill_blank"], "fill_blank")).toBe("fill_blank");
    expect(["fill_blank", "ayah_number"]).toContain(
      pickQuestionType(["fill_blank", "ayah_number"]),
    );
  });

  it("handles empty question lists and unavailable blank positions", () => {
    expect(pickQuestionType([])).toBeNull();
    expect(generateHiddenIndex(false, false, false)).toBe(1);
    expect([0, 1, 2]).toContain(generateHiddenIndex(true, true, true));
  });

  it("maps deterministic random values to the available options", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(pickQuestionType(["fill_blank", "page_number"])).toBe("page_number");
    expect(generateHiddenIndex(true, false, true)).toBe(2);
  });
});
