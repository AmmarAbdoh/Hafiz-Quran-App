/*
 * A recitation as a WAV file: 16-bit mono PCM, which every browser plays and
 * `scripts/tasmee/lib/audio.mjs` reads.
 *
 * Kept as 16-bit from the moment it is captured rather than as the float
 * samples the microphone delivers: a run is held in memory until it is over,
 * and half the size is the difference that matters on a phone - about 1.9MB
 * a minute instead of 3.8MB.
 */

/**
 * Float samples as 16-bit integers.
 *
 * Clamped before scaling: a sample past ±1 wraps to the opposite sign as a
 * 16-bit integer, which is a click rather than a loud moment.
 */
export function toPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]!));
    out[index] = Math.round(sample * 32767);
  }
  return out;
}

/** The blocks of a recording, in order, as one WAV file. */
export function encodeWav(
  blocks: readonly Int16Array[],
  sampleRate: number,
): Uint8Array<ArrayBuffer> {
  let samples = 0;
  for (const block of blocks) samples += block.length;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(at + index, text.charCodeAt(index));
    }
  };

  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
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
  view.setUint32(40, samples * 2, true);

  let at = 44;
  for (const block of blocks) {
    for (let index = 0; index < block.length; index += 1) {
      view.setInt16(at, block[index]!, true);
      at += 2;
    }
  }
  return bytes;
}
