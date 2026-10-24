import { describe, expect, it } from "vitest";
import { computeFbank } from "./fbank";

const SAMPLE_RATE = 16000;

function tone(hz: number, seconds: number): Float32Array {
  const samples = new Float32Array(Math.round(SAMPLE_RATE * seconds));
  for (let i = 0; i < samples.length; i += 1) {
    samples[i] = Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE);
  }
  return samples;
}

const loudestBin = (features: Float32Array, frame: number) => {
  let best = 0;
  for (let bin = 1; bin < 80; bin += 1) {
    if (features[frame * 80 + bin]! > features[frame * 80 + best]!) best = bin;
  }
  return best;
};

describe("the filterbank the recogniser was trained on", () => {
  /*
   * The model card is unusually direct about this: "The features must be
   * kaldi fbank, not a mel-spectrogram: a slaney-mel front end roughly
   * doubles the error rate." These tests pin the shape of the output; the
   * proof that the numbers themselves are right is the bench, where this
   * front end reproduces the published phoneme error rate.
   */
  it("produces 80 bins per 10ms frame, snipping partial ones", () => {
    // 25ms window, 10ms hop: one second gives 1 + (16000-400)/160 frames.
    const { features, frameCount, dim } = computeFbank(tone(440, 1));

    expect(frameCount).toBe(98);
    expect(dim).toBe(80);
    expect(features).toHaveLength(98 * 80);
  });

  it("returns nothing for audio shorter than one window", () => {
    expect(computeFbank(new Float32Array(399)).frameCount).toBe(0);
  });

  it("puts a low tone in a low bin and a high tone in a high one", () => {
    const low = computeFbank(tone(300, 0.2));
    const high = computeFbank(tone(3000, 0.2));

    expect(loudestBin(low.features, 5)).toBeLessThan(20);
    expect(loudestBin(high.features, 5)).toBeGreaterThan(45);
  });

  /* Kaldi floors the energy before the log rather than returning -Infinity. */
  it("floors silence instead of returning infinities", () => {
    const { features } = computeFbank(new Float32Array(SAMPLE_RATE / 2));

    expect(features.every((value) => Number.isFinite(value))).toBe(true);
  });

  it("refuses audio that is not at the rate the model expects", () => {
    expect(() => computeFbank(tone(440, 0.1), 44100)).toThrow(/16kHz/);
  });
});
