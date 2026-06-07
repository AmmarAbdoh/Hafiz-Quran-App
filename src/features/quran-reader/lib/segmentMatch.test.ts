import { describe, expect, it } from "vitest";
import { buildExpectedWord } from "@/features/quran-reader/lib/constrainedWordAligner";
import {
  matchRecitationSegment,
  stripReRecitedPrefix,
} from "@/features/quran-reader/lib/segmentMatch";

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
    const result = matchRecitationSegment(
      words,
      2,
      "بسم الله الرحمن الرحيم",
    );
    expect(result.wrongAttempt).toBe(false);
    expect(result.newPointer).toBe(4);
    expect(result.revealedLocations).toEqual(["1:1:3", "1:1:4"]);
  });

  it("stripReRecitedPrefix removes matched earlier words", () => {
    const tokens = stripReRecitedPrefix(
      ["بسم", "الله", "الرحمن"],
      words,
      2,
    );
    expect(tokens).toEqual(["الرحمن"]);
  });
});
