import { describe, expect, it } from "vitest";
import {
  alignRecitation,
  wasRecitedCorrectly,
  type RecitedWordStatus,
} from "./alignRecitation";

/** Al-Fatihah 1:2, as the page gives it. */
const EXPECTED = ["ٱلْحَمْدُ", "لِلَّهِ", "رَبِّ", "ٱلْعَٰلَمِينَ"];

const statuses = (
  expected: readonly string[],
  spoken: readonly string[],
): RecitedWordStatus[] =>
  alignRecitation(expected, spoken).words.map((word) => word.status);

describe("a recitation that was right", () => {
  it("accepts it word for word", () => {
    const alignment = alignRecitation(EXPECTED, EXPECTED);

    expect(alignment.errors).toBe(0);
    expect(alignment.rate).toBe(0);
    expect(alignment.words.every((w) => w.status === "correct")).toBe(true);
    expect(wasRecitedCorrectly(alignment)).toBe(true);
  });

  /*
   * An ASR writes the words plainly; the page carries full tashkeel. Both
   * sides are normalised, so the difference must not read as a mistake.
   */
  it("accepts it when the transcript carries no diacritics", () => {
    const alignment = alignRecitation(EXPECTED, [
      "الحمد",
      "لله",
      "رب",
      "العالمين",
    ]);

    expect(alignment.errors).toBe(0);
    expect(wasRecitedCorrectly(alignment)).toBe(true);
  });
});

describe("a recitation that was not", () => {
  it("names the word that was replaced, not just the count", () => {
    const alignment = alignRecitation(EXPECTED, [
      "الحمد",
      "لله",
      "رب",
      "الناس",
    ]);

    expect(statuses(EXPECTED, ["الحمد", "لله", "رب", "الناس"])).toEqual([
      "correct",
      "correct",
      "correct",
      "substituted",
    ]);
    expect(alignment.words.at(-1)).toMatchObject({ heard: "الناس" });
    expect(wasRecitedCorrectly(alignment)).toBe(false);
  });

  it("names the word that was skipped", () => {
    expect(statuses(EXPECTED, ["الحمد", "لله", "العالمين"])).toEqual([
      "correct",
      "correct",
      "missing",
      "correct",
    ]);
  });

  it("marks everything after the point the reciter stopped", () => {
    expect(statuses(EXPECTED, ["الحمد", "لله"])).toEqual([
      "correct",
      "correct",
      "missing",
      "missing",
    ]);
  });

  it("reports a word said that the page never asked for", () => {
    const alignment = alignRecitation(EXPECTED, [
      "الحمد",
      "لله",
      "رب",
      "العالمين",
      "الرحمن",
    ]);

    expect(alignment.extra).toEqual(["الرحمن"]);
    expect(alignment.errors).toBe(1);
  });

  it("counts nothing said at all as every word missing", () => {
    const alignment = alignRecitation(EXPECTED, []);

    expect(alignment.errors).toBe(4);
    expect(alignment.rate).toBe(1);
    expect(alignment.words.every((w) => w.status === "missing")).toBe(true);
  });
});

/*
 * The defect this replaces: the old test counted shared letters in any order
 * and called 75% a match, so words built on the same root matched each other.
 */
describe("words that the old matcher confused", () => {
  it("does not accept a word whose letters were rearranged", () => {
    const alignment = alignRecitation(["كتب"], ["بتك"]);

    expect(alignment.words[0]?.status).toBe("substituted");
    expect(wasRecitedCorrectly(alignment)).toBe(false);
  });

  it("does not accept a different word from the same root", () => {
    const alignment = alignRecitation(["يعلمون"], ["تعلمون"]);

    expect(alignment.words[0]?.status).toBe("substituted");
  });

  it("keeps order, so the right words in the wrong places are wrong", () => {
    const alignment = alignRecitation(["رب", "العالمين"], ["العالمين", "رب"]);

    expect(alignment.errors).toBeGreaterThan(0);
    expect(wasRecitedCorrectly(alignment)).toBe(false);
  });
});

describe("the threshold", () => {
  /*
   * One slip in a long passage is a transcription wobble; one slip in four
   * words is a mistake. The rate is what makes those different, and it is why
   * the judgement is not a raw error count.
   */
  it("forgives a single slip in a long passage", () => {
    const long = Array.from({ length: 40 }, (_, i) => `w${i}`);
    const spoken = [...long];
    spoken[17] = "something-else";

    expect(wasRecitedCorrectly(alignRecitation(long, spoken))).toBe(true);
  });

  it("does not forgive a single slip in a short one", () => {
    const spoken = [...EXPECTED];
    spoken[3] = "something-else";

    expect(wasRecitedCorrectly(alignRecitation(EXPECTED, spoken))).toBe(false);
  });
});
