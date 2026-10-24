import { describe, expect, it } from "vitest";
import { decodeFrames } from "./ctcGreedy";

const BLANK = 3;
const VOCAB = 4;

/**
 * Frames where one token is almost certain.
 *
 * `-0.01` is a probability near 1 and `-9` near zero, so a sequence of these
 * reads as "this sound, then that one" - the same fixture shape the aligner's
 * tests use, because this reads the same log-probabilities.
 */
function framesSaying(tokens: readonly number[]): Float32Array {
  const data = new Float32Array(tokens.length * VOCAB).fill(-9);
  tokens.forEach((token, frame) => {
    data[frame * VOCAB + token] = -0.01;
  });
  return data;
}

/* Tokens 0 and 1 are the same sound held for different counts, which is how
   the table writes a madd; token 2 is a different sound. See
   `identityClasses`. */
const SYMBOLS = ["ا", "اا", "بَ", "<blank>"];
const CLASS_OF = new Int32Array([0, 0, 1, 2]);

/*
 * What this is for: the alignment says a word scored badly and hands over the
 * frames it gave that word. Reading those frames freely says what was
 * actually there, which is the part a reciter can act on.
 */
describe("what was heard over one stretch of a run", () => {
  it("reads only the frames it was given", () => {
    const frames = framesSaying([0, 0, 2, 2, BLANK, 1]);

    expect(decodeFrames(frames, VOCAB, 2, 3, BLANK, SYMBOLS, CLASS_OF)).toEqual(
      ["بَ"],
    );
  });

  it("reads a sound held over several frames once", () => {
    const frames = framesSaying([2, 2, 2, 2]);

    expect(decodeFrames(frames, VOCAB, 0, 3, BLANK, SYMBOLS, CLASS_OF)).toEqual(
      ["بَ"],
    );
  });

  /*
   * A madd drifting from one length to another mid-vowel is one sound, and
   * the ids distinguish the lengths. Collapsing by id would put a letter in
   * the readout that nobody said twice.
   */
  it("reads a madd whose length drifted as one sound", () => {
    const frames = framesSaying([0, 0, 1, 1]);

    expect(decodeFrames(frames, VOCAB, 0, 3, BLANK, SYMBOLS, CLASS_OF)).toEqual(
      ["ا"],
    );
  });

  it("says the same sound twice when a blank separated them", () => {
    const frames = framesSaying([2, BLANK, 2]);

    expect(decodeFrames(frames, VOCAB, 0, 2, BLANK, SYMBOLS, CLASS_OF)).toEqual(
      ["بَ", "بَ"],
    );
  });

  /* A word the alignment never reached has no frames, and asking about them
     must not read somebody else's. */
  it("says nothing for a range that is not one", () => {
    const frames = framesSaying([0, 1, 2]);

    expect(decodeFrames(frames, VOCAB, -1, 2, BLANK, SYMBOLS)).toEqual([]);
    expect(decodeFrames(frames, VOCAB, 2, 1, BLANK, SYMBOLS)).toEqual([]);
  });
});
