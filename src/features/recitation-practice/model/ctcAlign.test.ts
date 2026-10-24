import { describe, expect, it } from "vitest";
import {
  alignToExpected,
  WORD_SAID_THRESHOLD,
  type WordScore,
  type WordSpan,
} from "./ctcAlign";

/*
 * The question the verdict asks, which `practiceVerdict` asks with the same
 * threshold. `alignToExpected` already scores a word with no frames as 0, so
 * there is nothing for a `frames > 0` guard to add.
 */
const wasWordSaid = (score: WordScore) => score.score >= WORD_SAID_THRESHOLD;

const BLANK = 3;
const VOCAB = 4;

/**
 * Frames where one token is almost certain.
 *
 * `-0.01` is a probability near 1, `-9` near zero, so a sequence of these
 * reads as "this phoneme, then that one", which is what the aligner has to
 * follow.
 */
function framesSaying(tokens: readonly number[]): Float32Array {
  const data = new Float32Array(tokens.length * VOCAB).fill(-9);
  tokens.forEach((token, frame) => {
    data[frame * VOCAB + token] = -0.01;
  });
  return data;
}

const spans = (...pairs: [number, number][]): WordSpan[] =>
  pairs.map(([from, to]) => ({ from, to }));

describe("scoring a recitation against the expected words", () => {
  it("scores a word that was clearly said", () => {
    // Expected "0 1", said "0 0 1 1" - phonemes held over several frames.
    const scores = alignToExpected(
      framesSaying([0, 0, 1, 1]),
      4,
      VOCAB,
      [0, 1],
      spans([0, 1], [1, 2]),
      BLANK,
    );

    expect(scores[0]!.score).toBeGreaterThan(0.9);
    expect(scores[1]!.score).toBeGreaterThan(0.9);
    expect(scores.every(wasWordSaid)).toBe(true);
  });

  /*
   * The case the error-rate comparison lost: a short word with one phoneme
   * wrong. As a rate it is a small fraction; as a probability the word simply
   * was not said.
   */
  it("fails a word whose phoneme was something else", () => {
    // Expected "0 1", but the second frame is clearly token 2.
    const scores = alignToExpected(
      framesSaying([0, 2]),
      2,
      VOCAB,
      [0, 1],
      spans([0, 1], [1, 2]),
      BLANK,
    );

    expect(wasWordSaid(scores[0]!)).toBe(true);
    expect(wasWordSaid(scores[1]!)).toBe(false);
  });

  it("gives a word that was never reached no frames at all", () => {
    // Three expected words, audio only long enough to carry one.
    const scores = alignToExpected(
      framesSaying([0]),
      1,
      VOCAB,
      [0, 1, 2],
      spans([0, 1], [1, 2], [2, 3]),
      BLANK,
    );

    expect(scores[2]!.frames).toBe(0);
    expect(wasWordSaid(scores[2]!)).toBe(false);
  });

  it("says which frames each word occupied", () => {
    const scores = alignToExpected(
      framesSaying([0, 0, 0, 1]),
      4,
      VOCAB,
      [0, 1],
      spans([0, 1], [1, 2]),
      BLANK,
    );

    expect(scores[0]!.startFrame).toBe(0);
    expect(scores[0]!.frames).toBe(3);
    expect(scores[1]!.startFrame).toBe(3);
  });

  /*
   * CTC keeps blanks between repeats for exactly this reason: without one,
   * a doubled phoneme collapses into a single occurrence.
   */
  it("keeps a doubled phoneme apart", () => {
    const scores = alignToExpected(
      framesSaying([0, BLANK, 0]),
      3,
      VOCAB,
      [0, 0],
      spans([0, 1], [1, 2]),
      BLANK,
    );

    expect(scores[0]!.frames).toBeGreaterThan(0);
    expect(scores[1]!.frames).toBeGreaterThan(0);
  });

  it("returns empty scores for silence", () => {
    const scores = alignToExpected(
      new Float32Array(0),
      0,
      VOCAB,
      [0, 1],
      spans([0, 1], [1, 2]),
      BLANK,
    );

    expect(scores.map((s) => s.frames)).toEqual([0, 0]);
  });
});
