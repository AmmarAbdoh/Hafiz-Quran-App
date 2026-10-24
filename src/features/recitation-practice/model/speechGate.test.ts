import { describe, expect, it } from "vitest";
import {
  acceptSpeech,
  createSpeechGate,
  REFERENCE_BLOCK_SECONDS,
} from "./speechGate";

/** A reciter holding the phone: loud at the microphone. */
const RECITER = 0.18;
/** Someone talking across the room: audible, but far away. */
const BYSTANDER = 0.025;
const ROOM_TONE = 0.002;
/** 4096 samples at 16kHz, which is what Chrome delivers. */
const BLOCK = REFERENCE_BLOCK_SECONDS;

const feed = (
  gate: ReturnType<typeof createSpeechGate>,
  rms: number,
  times: number,
  blockSeconds = BLOCK,
) => {
  const accepted: boolean[] = [];
  for (let i = 0; i < times; i += 1) {
    accepted.push(acceptSpeech(gate, rms, blockSeconds));
  }
  return accepted;
};

describe("separating the reciter from the room", () => {
  /*
   * The first sound after the tap is as likely to be a pop or the phone
   * being set down as it is to be a word, so it is admitted but does not get
   * to set the bar - see the next test for why that matters.
   */
  it("admits the first voice it hears without learning from it", () => {
    const gate = createSpeechGate();

    expect(acceptSpeech(gate, RECITER, BLOCK)).toBe(true);
    expect(gate.level).toBeLessThan(RECITER);
  });

  it("learns the reciter's level over the first second", () => {
    const gate = createSpeechGate();
    // Four blocks is roughly a second at the reference size.
    feed(gate, RECITER, 20);

    expect(gate.level).toBeCloseTo(RECITER, 2);
  });

  /*
   * Reproduced from a review: a mic pop as the very first sound set the bar
   * many times above the reciter's own voice, and nothing the gate then
   * rejected could bring it down - they were locked out for about half a
   * minute with no error shown.
   */
  it("still hears the reciter after a pop is the first thing heard", () => {
    const gate = createSpeechGate();

    acceptSpeech(gate, 0.9, BLOCK);

    expect(feed(gate, RECITER, 4).some(Boolean)).toBe(true);
  });

  /* The problem this exists for: a brother talking nearby was being recited. */
  it("ignores someone talking across the room", () => {
    const gate = createSpeechGate();
    feed(gate, RECITER, 20);

    expect(feed(gate, BYSTANDER, 10).some(Boolean)).toBe(false);
  });

  it("still hears the reciter when they go quiet at the end of an ayah", () => {
    const gate = createSpeechGate();
    feed(gate, RECITER, 20);

    // Half their usual level is still plainly them.
    expect(acceptSpeech(gate, RECITER / 2, BLOCK)).toBe(true);
  });

  it("lets nothing through while the room is merely breathing", () => {
    const gate = createSpeechGate();
    feed(gate, RECITER, 20);

    expect(feed(gate, ROOM_TONE, 5).some(Boolean)).toBe(false);
  });

  /*
   * Someone who moves the phone further away, or tires towards the end of a
   * page, must not be shut out - so the learned level decays rather than
   * locking onto their loudest moment.
   */
  it("follows a reciter who gets quieter over time", () => {
    const gate = createSpeechGate();
    feed(gate, RECITER, 20);
    // A long stretch of silence while they settle somewhere further away.
    feed(gate, ROOM_TONE, 600);

    expect(acceptSpeech(gate, RECITER / 5, BLOCK)).toBe(true);
  });

  /*
   * Reproduced from a review: two blocks of a cough lifted the bar above the
   * reciter's own voice, and nothing it then rejected could bring it down -
   * 0 of the next 352 blocks of recitation got through.
   */
  it("still hears the reciter after a cough", () => {
    const gate = createSpeechGate();
    feed(gate, 0.05, 20);
    feed(gate, 0.4, 2);

    const after = [];
    for (let i = 0; i < 40; i += 1) {
      after.push(
        acceptSpeech(gate, 0.05, BLOCK),
        acceptSpeech(gate, 0.008, BLOCK),
      );
    }

    expect(after.filter((_, index) => index % 2 === 0).every(Boolean)).toBe(
      true,
    );
  });

  it("recovers once a sustained noise has stopped", () => {
    const gate = createSpeechGate();
    feed(gate, 0.05, 20);
    // Several seconds of something loud right by the microphone.
    feed(gate, 0.3, 20);

    // Then the reciter alone, with ordinary room tone between words.
    let heard = 0;
    for (let i = 0; i < 120; i += 1) {
      if (acceptSpeech(gate, 0.05, BLOCK)) heard += 1;
      acceptSpeech(gate, 0.008, BLOCK);
    }

    expect(heard).toBeGreaterThan(0);
    expect(acceptSpeech(gate, 0.05, BLOCK)).toBe(true);
  });

  it("does not let the room raise the bar it is judged against", () => {
    const gate = createSpeechGate();
    feed(gate, RECITER, 20);
    const before = gate.level;

    feed(gate, BYSTANDER, 50);

    expect(gate.level).toBeLessThanOrEqual(before);
  });

  /*
   * A ScriptProcessorNode is sized in samples, so the same 4096 is 256ms on
   * Chrome's 16kHz context and 85ms on the 48kHz one Firefox forces. The gate
   * used to decay and rise per block, so it learned a different reciter on
   * each browser.
   */
  it("learns the same level whatever the block size", () => {
    const chrome = createSpeechGate();
    const firefox = createSpeechGate();
    const firefoxBlock = 4096 / 48000;

    feed(chrome, RECITER, 20);
    // The same two seconds of audio, in three times as many blocks.
    feed(firefox, RECITER, 60, firefoxBlock);

    expect(firefox.level).toBeCloseTo(chrome.level, 2);
  });

  it("decays at the same rate whatever the block size", () => {
    const chrome = createSpeechGate();
    const firefox = createSpeechGate();
    const firefoxBlock = 4096 / 48000;

    feed(chrome, RECITER, 20);
    feed(firefox, RECITER, 60, firefoxBlock);
    // Then the same four seconds of near-silence.
    feed(chrome, ROOM_TONE, 16);
    feed(firefox, ROOM_TONE, 48, firefoxBlock);

    expect(firefox.level).toBeCloseTo(chrome.level, 2);
  });
});

/*
 * The same voice must teach the gate the same thing on either browser.
 *
 * A `ScriptProcessorNode` is sized in samples, so 4096 is 256ms on Chrome's
 * 16kHz context and 85ms on the 48kHz one Firefox forces - three times as
 * many blocks a second. The decay and the rise cap were scaled for that and
 * the rise rate was not, so Firefox closed the gap to the reciter's level
 * three times as fast and learned a different reciter. Reported by review.
 */
describe("learning the same reciter whatever the block size is", () => {
  const steady = (count: number, seconds: number, rms: number) => {
    const gate = createSpeechGate();
    for (let index = 0; index < count; index += 1) {
      acceptSpeech(gate, rms, seconds);
    }
    return gate.level;
  };

  it("reaches the same level for the same audio", () => {
    /* Two seconds of one steady voice, in Chrome's blocks and in Firefox's. */
    const chrome = steady(8, BLOCK, 0.05);
    const firefox = steady(24, BLOCK / 3, 0.05);

    /*
     * Within 2%, against 7.4% before the rise was scaled. Not nearer because
     * `MAX_RISE_PER_BLOCK` caps each block and the cap binds at different
     * points in the climb; what matters is that neither browser ends up with
     * a bar the other's reciter would fail.
     */
    expect(Math.abs(chrome - firefox) / chrome).toBeLessThan(0.02);
  });

  /* And the rate still is a rate: more audio means a higher bar. */
  it("still rises further the longer it listens", () => {
    expect(steady(16, BLOCK, 0.05)).toBeGreaterThan(steady(4, BLOCK, 0.05));
  });
});
