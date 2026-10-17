import { describe, expect, it } from "vitest";
import { buildExpectedWord } from "@/features/recitation-practice/model/constrainedWordAligner";
import {
  matchRecitationSegment,
  stripReRecitedPrefix,
} from "@/features/recitation-practice/model/segmentMatch";

describe("segmentMatch", () => {
  const words = [
    buildExpectedWord("1:1:1", "1:1", "بِسْمِ", "بسم"),
    buildExpectedWord("1:1:2", "1:1", "اللَّهِ", "الله"),
    buildExpectedWord("1:1:3", "1:1", "الرَّحْمَٰنِ", "الرحمن"),
    buildExpectedWord("1:1:4", "1:1", "الرَّحِيمِ", "الرحيم"),
  ];

  it("advances multiple words from one phrase", () => {
    const result = matchRecitationSegment(words, 0, "بسم الله الرحمن");
    expect(result.wrongAttempt).toBe(false);
    expect(result.newPointer).toBe(3);
    expect(result.revealedLocations).toEqual(["1:1:1", "1:1:2", "1:1:3"]);
  });

  it("flags wrong speech when nothing matches from pointer", () => {
    const result = matchRecitationSegment(words, 0, "الحمد");
    expect(result.wrongAttempt).toBe(true);
    expect(result.newPointer).toBe(0);
    expect(result.revealedLocations).toHaveLength(0);
  });

  it("ignores re-recited ayah prefix and continues from pointer", () => {
    const result = matchRecitationSegment(words, 2, "بسم الله الرحمن الرحيم");
    expect(result.wrongAttempt).toBe(false);
    expect(result.newPointer).toBe(4);
    expect(result.revealedLocations).toEqual(["1:1:3", "1:1:4"]);
  });

  /*
   * The matcher used to stop at the first word it could not place, so one
   * misheard word in the middle of a phrase halted the whole page. A reciter
   * carries on past a slip; so does this now, and it says which word it was.
   */
  it("carries on past a wrong word in the middle and names it", () => {
    const result = matchRecitationSegment(words, 0, "بسم الناس الرحمن");

    expect(result.newPointer).toBe(3);
    expect(result.wrongAttempt).toBe(false);
    expect(result.revealedLocations).toEqual(["1:1:1", "1:1:2", "1:1:3"]);
    expect(result.wrongLocations).toEqual(["1:1:2"]);
  });

  it("names a word skipped in the middle", () => {
    const result = matchRecitationSegment(words, 0, "بسم الرحمن");

    expect(result.wrongLocations).toContain("1:1:2");
    expect(result.newPointer).toBeGreaterThan(1);
  });

  it("says nothing is wrong when the phrase was right", () => {
    const result = matchRecitationSegment(words, 0, "بسم الله الرحمن");

    expect(result.wrongLocations).toEqual([]);
  });

  /*
   * Words after the phrase have not been reached, as distinct from one
   * skipped in the middle, which has. Trailing words must not be marked.
   */
  it("leaves words the reciter has not reached alone", () => {
    const result = matchRecitationSegment(words, 0, "بسم الله");

    expect(result.newPointer).toBe(2);
    expect(result.revealedLocations).toEqual(["1:1:1", "1:1:2"]);
    expect(result.wrongLocations).toEqual([]);
  });

  /*
   * The mushaf writes this word with a superscript alef and a transcript
   * writes a plain one. They have to meet, and this word is in Al-Fatihah.
   */
  it("matches the mushaf's superscript alef against a plain one", () => {
    const result = matchRecitationSegment(words, 2, "الرحمن");

    expect(result.wrongLocations).toEqual([]);
    expect(result.newPointer).toBe(3);
  });

  it("stripReRecitedPrefix removes matched earlier words", () => {
    const tokens = stripReRecitedPrefix(["بسم", "الله", "الرحمن"], words, 2);
    expect(tokens).toEqual(["الرحمن"]);
  });
});
