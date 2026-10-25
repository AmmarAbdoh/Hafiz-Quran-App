/*
 * Saving a run, so the next thresholds are measured on the right voice.
 *
 * Every number tuned so far comes from professional reciters: words cut out
 * of Husary and Alafasy at quran.com's timestamps. A learner's mistakes are
 * not those mistakes - the bench has no fixture at all for "said the word,
 * but said it wrong" - so the accuracy on the people this is for is not
 * known. It cannot be, until there are recordings of them.
 *
 * Development only. The endpoint is a dev-server middleware (see
 * `vite.config.ts`), nothing calls this in a production build, and the
 * microphone audio goes to the machine the dev server is running on and
 * nowhere else.
 */

import type { HeardInstead } from "@/features/recitation-practice/model/phonemeText";

/** 16-bit mono PCM, which is what `scripts/tasmee/lib/audio.mjs` reads. */
function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(at + index, text.charCodeAt(index));
    }
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let index = 0; index < samples.length; index += 1) {
    /* Clamped before scaling: a sample past ±1 wraps to the opposite sign
       as a 16-bit integer, which is a click rather than a loud moment. */
    const sample = Math.max(-1, Math.min(1, samples[index]!));
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  /* In chunks: `String.fromCharCode(...bytes)` on a minute of audio is a
     million arguments and overflows the call stack. */
  let binary = "";
  const step = 0x8000;
  for (let at = 0; at < bytes.length; at += step) {
    binary += String.fromCharCode(...bytes.subarray(at, at + step));
  }
  return btoa(binary);
}

/**
 * Something that happened during a run, at `t` seconds of its audio.
 *
 * The clock is the recogniser's - the time of the last phoneme heard - so an
 * event lines up with the phonemes around it and with the saved WAV, not
 * with however long the page took to react.
 */
export type RunEvent = { t: number } & RunEventDetail;

export type RunEventDetail =
  | { kind: "cursor"; from: string | null; to: string | null }
  | { kind: "stumble"; location: string; heard: string[] }
  | { kind: "passed-over"; locations: string[] }
  | { kind: "hold"; location: string }
  | { kind: "release"; location: string }
  | { kind: "reveal"; locations: string[] }
  | { kind: "gave-up"; locations: string[] }
  | { kind: "stop-on-mistake"; on: boolean }
  | { kind: "page"; location: string | null }
  | { kind: "stop" };

export interface RecordingMeta {
  /** The ayat the page covered. */
  verseKeys: string[];
  /**
   * The words the page expected, in order, and the phonemes they want -
   * and, from runs saved after it was added, the page's text for them.
   */
  expected: { locations: string[]; units: string[]; text?: string }[];
  /** Whether stop-on-mistake was on when the run began. */
  stopOnMistake?: boolean;
  /** What happened, in order; absent from runs saved before it existed. */
  events?: RunEvent[];
  /** For each word the verdict listed, what was heard in its place. */
  misreadHeard?: { location: string; heard: HeardInstead }[];
  /** How far the cursor reached, and of how many. */
  progressIndex: number;
  totalWords: number;
  stoppedShort: boolean;
  /** What the verdict said. */
  misreadLocations: string[];
  /** Words the cursor was carried past without hearing. */
  skippedLocations: string[];
  /**
   * Words something else was said at, and the phonemes heard there.
   *
   * The one kind of mistake the audio cannot be re-measured for: a word
   * fumbled and then said correctly is in the recording twice, and any later
   * pass over it will align to the good attempt and call the word right.
   * Only the live cursor was there for the first one.
   */
  stumbles: { location: string; heard: string[] }[];
  /**
   * How long the cursor stood on each word, in order.
   *
   * Every word rather than only the slow ones: a long word legitimately
   * takes long - ٱلضَّآلِّينَ held its madd is three and a half seconds - so
   * which of these is a struggle is a question for the analysis, not for
   * the thing doing the recording.
   */
  held: { locations: string[]; ms: number }[];
  /**
   * Every phoneme the recogniser emitted: symbol, confidence, seconds, and -
   * from runs saved after they were kept - the runner-ups it considered, as
   * [symbol, probability].
   */
  heard: (
    | [string, number, number]
    | [string, number, number, [string, number][]]
  )[];
  strictMode: boolean;
  recordedAt: string;
  /** Whatever the reciter said about the run, if they said anything. */
  note: string;
}

/**
 * Write one run to `scripts/tasmee/fixtures/recorded/`.
 *
 * Returns the saved name, or throws with whatever the dev server said - the
 * caller shows it, because a capture that silently did nothing is worse than
 * no capture at all.
 */
export async function saveRecording(
  samples: Float32Array,
  sampleRate: number,
  meta: RecordingMeta,
): Promise<string> {
  const id = `recorded-${meta.recordedAt.replace(/[:.]/g, "-")}`;
  const response = await fetch("/__capture", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id,
      wav: toBase64(encodeWav(samples, sampleRate)),
      meta,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return `${id}.wav`;
}
