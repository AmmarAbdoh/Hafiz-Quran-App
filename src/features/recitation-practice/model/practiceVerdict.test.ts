import { describe, expect, it } from "vitest";
import {
  findMisreadWords,
  stoppedShort,
  STRICT_WEAK_WORDS_TOLERATED,
  wasTheCursors,
  type ScoredWord,
} from "./practiceVerdict";

const word = (ayah: string, score: number, skipped = false): ScoredWord => ({
  ayah,
  score,
  skipped,
});

/* 0.1 is the threshold; 0.025 is weak and 0.9 is comfortably said. */
describe("deciding which words to mark", () => {
  it("marks nothing when every word was heard", () => {
    expect(
      findMisreadWords([word("1:1", 0.9), word("1:1", 0.8), word("1:2", 0.95)]),
    ).toEqual([]);
  });

  /*
   * The measurement this exists for: one weak word per ayah is how a clean
   * recitation normally looks, and marking it rejected 61% of them.
   */
  it("forgives a single weak word in an ayah", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.9),
        word("1:1", 0.025),
        word("1:1", 0.8),
      ]),
    ).toEqual([]);
  });

  it("marks them once a second one goes weak in the same ayah", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.005),
        word("1:1", 0.9),
        word("1:1", 0.02),
      ]),
    ).toEqual([0, 2]);
  });

  /*
   * A dropped word drags its neighbours down with it. Losing the tolerance
   * says something in the ayah went wrong, not that every doubtful word did.
   */
  it("marks only the words scored as unsaid, not the doubtful ones beside them", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.075),
        word("1:1", 0.001),
        word("1:1", 0.06),
        word("1:1", 0.9),
      ]),
    ).toEqual([1]);
  });

  it("marks the weakest when every weak word is only doubtful", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.075),
        word("1:1", 0.9),
        word("1:1", 0.04),
      ]),
    ).toEqual([2]);
  });

  it("marks a doubtful word the cursor saw skipped", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.075),
        word("1:1", 0.005, true),
        word("1:1", 0.9),
      ]),
    ).toEqual([1]);
  });

  it("counts the tolerance per ayah, not per page", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.025),
        word("1:1", 0.9),
        word("1:2", 0.015),
        word("1:2", 0.8),
      ]),
    ).toEqual([]);
  });

  /*
   * The hole the tolerance leaves: a reciter who drops exactly one word is
   * forgiven for it. The cursor having watched them go past it is evidence
   * the score alone cannot provide.
   */
  it("withdraws the tolerance from a word the cursor saw skipped", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.9),
        word("1:1", 0.001, true),
        word("1:1", 0.8),
      ]),
    ).toEqual([1]);
  });

  it("does not mark a skipped word the audio supports after all", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.9),
        word("1:1", 0.85, true),
        word("1:1", 0.8),
      ]),
    ).toEqual([]);
  });

  /*
   * The cursor reported a skip on 44 of 135 correct recitations, so its word
   * alone accuses too many people. A word merely scoring badly keeps its
   * tolerance; one that scores near nothing does not.
   */
  it("keeps the tolerance for a weak word that was only scored badly", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.9),
        word("1:1", 0.075, true),
        word("1:1", 0.8),
      ]),
    ).toEqual([]);
  });

  it("marks the whole ayah's weak words once the tolerance is gone", () => {
    expect(
      findMisreadWords([
        word("1:1", 0.001, true),
        word("1:1", 0.9),
        word("1:1", 0.02),
      ]),
    ).toEqual([0, 2]);
  });
});

/*
 * The operating point for someone who would rather be doubted than told they
 * were perfect when they were not. Measured over 3,595 clips: 7.8% of
 * mistakes missed rather than 15.2%, for 6.3% of correct recitations accused
 * rather than 2.3%. See STRICT_WEAK_WORDS_TOLERATED.
 */
describe("correcting strictly", () => {
  const strict = (words: Parameters<typeof findMisreadWords>[0]) =>
    findMisreadWords(words, undefined, STRICT_WEAK_WORDS_TOLERATED);

  it("marks the one weak word the default forgives", () => {
    const ayah = [word("1:1", 0.9), word("1:1", 0.075), word("1:1", 0.8)];

    expect(findMisreadWords(ayah)).toEqual([]);
    expect(strict(ayah)).toEqual([1]);
  });

  it("marks every weak word of an ayah, doubtful ones included", () => {
    expect(
      strict([word("1:1", 0.075), word("1:1", 0.001), word("1:1", 0.06)]),
    ).toEqual([0, 1, 2]);
  });

  it("still says nothing about a recitation with no weak word in it", () => {
    expect(strict([word("1:1", 0.9), word("1:1", 0.8)])).toEqual([]);
  });

  /* The threshold itself does not move: a word at 0.1 was said. */
  it("does not lower the bar for what counts as weak", () => {
    expect(strict([word("1:1", 0.125), word("1:1", 0.9)])).toEqual([]);
  });
});

/*
 * How much of the page was left out, at both ends.
 *
 * This asked about one end for a long time, and a reciter who began halfway
 * down and carried on to the last word therefore reached the end: the run was
 * reported complete and clean, the bar read 100%, and the half they never
 * recited was never judged. The same failure as the abandoned page, in mirror
 * image.
 */
describe("deciding whether the page was recited in full", () => {
  /* A twenty-word page, in the spoken words the cursor counts. */
  const PAGE = 20;

  it("accepts a run that covered the whole page", () => {
    expect(stoppedShort(PAGE, { from: 0, to: PAGE })).toBe(false);
  });

  it("calls an abandoned page unfinished", () => {
    expect(stoppedShort(PAGE, { from: 0, to: 3 })).toBe(true);
  });

  /* The failure this was changed for. */
  it("calls a page begun halfway down unfinished", () => {
    expect(stoppedShort(PAGE, { from: 10, to: PAGE })).toBe(true);
  });

  it("calls a page missing both ends unfinished", () => {
    expect(stoppedShort(PAGE, { from: 8, to: 12 })).toBe(true);
  });

  /*
   * And forgives the ends themselves, which is why there is a tolerance at
   * all: the last word is cut short by trailing off, and the first by a
   * phoneme the model will not say. Two are allowed at the start for that
   * reason - see the constants.
   */
  it("forgives the closing word going unmatched", () => {
    expect(stoppedShort(PAGE, { from: 0, to: PAGE - 1 })).toBe(false);
  });

  it("forgives the opening words going unmatched", () => {
    expect(stoppedShort(PAGE, { from: 2, to: PAGE })).toBe(false);
    expect(stoppedShort(PAGE, { from: 3, to: PAGE })).toBe(true);
  });
});

describe("telling the cursor's stumbles from the reciter's", () => {
  /* Three words of 1:2; the units are what the recogniser emits. */
  const page = (span = { from: 0, to: 3 }) => ({
    spoken: [
      { locations: ["1:2:1"], units: ["ٱ", "لْ", "حَ", "مْ", "دُ"] },
      { locations: ["1:2:2"], units: ["لِ", "لَّا", "ه"] },
      { locations: ["1:2:3"], units: ["رَ", "بْ", "بِ"] },
    ],
    span,
  });

  it("keeps a stumble where something else was said", () => {
    expect(
      wasTheCursors(page(), "1:2:2", {
        heard: ["قُ", "ل", "هُ", "وَ", "ٱ", "ل"],
        times: 1,
      }),
    ).toBe(false);
  });

  it("puts down to the cursor a stumble that heard the word itself", () => {
    expect(
      wasTheCursors(page(), "1:2:2", {
        heard: ["لِ", "لَّا", "ه", "وَ", "ك", "م"],
        times: 1,
      }),
    ).toBe(true);
  });

  it("puts down to the cursor repeated stumbles before the recitation began", () => {
    const opening = { heard: ["بِ", "سْ", "مِ", "ل", "لَا", "ه"], times: 3 };
    expect(wasTheCursors(page(), "1:2:1", opening)).toBe(true);
    expect(wasTheCursors(page(), "1:2:1", { ...opening, times: 2 })).toBe(
      false,
    );
  });

  /* A reciter carrying on into a twin ayah and back: the slip to list. */
  it("keeps repeated stumbles inside the recitation", () => {
    expect(
      wasTheCursors(page(), "1:2:2", {
        heard: ["قُ", "ل", "هُ", "وَ", "ٱ", "ل"],
        times: 4,
      }),
    ).toBe(false);
  });

  it("keeps a stumble at a word it cannot find", () => {
    expect(
      wasTheCursors(page(), "2:1:1", { heard: ["ا", "ل", "م"], times: 5 }),
    ).toBe(false);
  });
});
