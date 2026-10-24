/*
 * Greedy CTC over a stream of encoder frames.
 *
 * The decode itself is three lines of argmax and a collapse rule; what makes
 * it worth its own module is that it has to work *across* chunks. The model
 * is handed 480ms at a time, so a symbol held over a chunk boundary would be
 * emitted twice unless the last class of the previous chunk is carried into
 * the next one. That is what `previousId` is for.
 *
 * Confidence is kept rather than thrown away, following the model's own
 * `decode_with_confidence.py`: "the model was unsure" and "the reciter said
 * something different" look identical in a plain transcript, and only one of
 * them should ever be shown to someone as a mistake.
 */

/** 10ms fbank hop with 4x subsampling in the encoder. */
const ENCODER_FRAME_SECONDS = 0.04;

export interface PhonemeEmission {
  id: number;
  symbol: string;
  /** Probability of the chosen class at the frame that emitted it. */
  confidence: number;
  /** Seconds from the start of the recitation. */
  seconds: number;
}

export interface CtcStreamState {
  /** Class emitted on the previous frame, blank included. */
  previousId: number;
  /** Encoder frames consumed so far, which is what dates each emission. */
  frameIndex: number;
}

export function createCtcStreamState(): CtcStreamState {
  return { previousId: -1, frameIndex: 0 };
}

/**
 * Decode one chunk's log-probabilities, advancing `state` in place.
 *
 * `logProbs` is laid out frame-major: `steps * vocab` values.
 */
export function decodeChunk(
  logProbs: Float32Array | Float64Array,
  steps: number,
  vocab: number,
  symbols: readonly string[],
  blankId: number,
  state: CtcStreamState,
): PhonemeEmission[] {
  const emissions: PhonemeEmission[] = [];

  for (let step = 0; step < steps; step += 1) {
    const base = step * vocab;
    let bestId = 0;
    let bestValue = -Infinity;

    for (let id = 0; id < vocab; id += 1) {
      const value = logProbs[base + id]!;
      if (value > bestValue) {
        bestValue = value;
        bestId = id;
      }
    }

    if (bestId !== blankId && bestId !== state.previousId) {
      emissions.push({
        id: bestId,
        symbol: symbols[bestId] ?? "",
        confidence: Math.exp(bestValue),
        seconds: state.frameIndex * ENCODER_FRAME_SECONDS,
      });
    }

    state.previousId = bestId;
    state.frameIndex += 1;
  }

  return emissions;
}

/**
 * What was heard over one stretch of a finished run.
 *
 * The same argmax as `decodeChunk`, driven by a frame range instead of by the
 * stream, and for a different purpose: not to follow the recitation but to
 * say what arrived where a word was expected. The forced alignment hands over
 * each word's frames, so this turns "that word scored badly" into something
 * the reciter can read - the sounds that were actually there in its place.
 *
 * `from` and `to` are both inclusive, as `WordScore` reports them.
 *
 * Collapsed by identity class rather than by token id, because the ids
 * distinguish how long a sound was held: a madd drifting from `ااا` to `اا`
 * mid-vowel is one sound, and emitting both would put a letter in the
 * readout that nobody said twice.
 */
export function decodeFrames(
  logProbs: Float32Array | Float64Array,
  vocab: number,
  from: number,
  to: number,
  blankId: number,
  symbols: readonly string[],
  /** From `identityClasses`; without it, every length is its own sound. */
  classOf?: Int32Array,
): string[] {
  const heard: string[] = [];
  if (from < 0 || to < from) return heard;

  let previousClass = -1;
  for (let frame = from; frame <= to; frame += 1) {
    const base = frame * vocab;
    let bestId = 0;
    let bestValue = -Infinity;

    for (let id = 0; id < vocab; id += 1) {
      const value = logProbs[base + id]!;
      if (value > bestValue) {
        bestValue = value;
        bestId = id;
      }
    }

    const current = classOf?.[bestId] ?? bestId;
    if (bestId !== blankId && current !== previousClass) {
      heard.push(symbols[bestId] ?? "");
    }
    previousClass = current;
  }

  return heard;
}
