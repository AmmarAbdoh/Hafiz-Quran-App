import {
  PRACTICE_MAX_PHRASE_MS,
  PRACTICE_MIN_ROLLING_MS,
  PRACTICE_MIN_SPEECH_MS,
  PRACTICE_ROLLING_CHUNK_MS,
  PRACTICE_ROLLING_WINDOW_MS,
  PRACTICE_SAMPLE_RATE,
  PRACTICE_SILENCE_MS,
  PRACTICE_SPEECH_RMS_THRESHOLD,
} from "@/features/recitation-practice/model/practiceConfig";
import {
  acceptSpeech,
  createSpeechGate,
} from "@/features/recitation-practice/model/speechGate";

export interface MicCaptureHandle {
  stop: () => void;
  /**
   * Ignore the microphone for a moment, because the app is about to make a
   * noise.
   *
   * Echo cancellation would also stop the app hearing itself, and it is off
   * on purpose: it reshapes sustained vowels, which is most of recitation,
   * and the model was trained on plain microphone audio. So the error sound
   * was arriving back as speech - and since it plays *because* a word was
   * wrong, it could be heard as the next wrong word and sound again.
   *
   * Muting for the length of the sound costs nothing: the reciter is being
   * told they made a mistake, so there is nothing to miss.
   */
  muteFor: (milliseconds: number) => void;
}

export interface PhraseMicCallbacks {
  /**
   * A finished phrase, after a pause. Whisper's unit of work.
   *
   * Optional, because the streaming recogniser wants `onAudioBlock` instead
   * and nothing reads these: cutting the audio into phrases and buffering
   * them for a listener that does not exist is work and memory spent on a
   * queue nobody drains.
   */
  onPhrase?: (samples: Float32Array) => void;
  /**
   * Every block the gate accepts, as it arrives.
   *
   * A streaming recogniser wants the audio continuously rather than cut into
   * phrases, and wants the silences left out: it carries its own state across
   * calls, so a pause is simply time it does not have to process.
   */
  onAudioBlock?: (samples: Float32Array) => void;
  onRollingChunk?: (samples: Float32Array) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onLevelChange?: (level: number) => void;
  /** Throttled; for the debug panel, which exists to answer "is my mic bad". */
  onDiagnostics?: (diagnostics: MicDiagnostics) => void;
}

/**
 * What the microphone is actually delivering, as opposed to what was asked
 * for.
 *
 * Every field here has been the cause of a real failure in this feature: the
 * browser handing back 48kHz when 16kHz was requested, gain so low that the
 * speech gate never opened, gain so high that vowels clipped, and audio
 * arriving from a device the reader did not expect. A level meter alone could
 * not tell those apart.
 */
export interface MicDiagnostics {
  /** The device the browser actually opened. */
  deviceLabel: string;
  /** What `AudioContext` gave us; 16000 was requested. */
  contextSampleRate: number;
  /** Loudest absolute sample seen so far, 0 to 1. */
  peak: number;
  /** Share of samples at full scale - a mic turned up too high. */
  clippedShare: number;
  /** Share of blocks the speech gate let through. */
  acceptedShare: number;
  /** Blocks seen, so the shares can be read as a sample size. */
  blocks: number;
}

export interface PhraseMicCaptureOptions {
  signal?: AbortSignal;
}

const MIC_LEVEL_REFERENCE_RMS = PRACTICE_SPEECH_RMS_THRESHOLD * 4;

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

/*
 * Bringing a block to the rate the model was trained on.
 *
 * The browser is asked for a 16kHz context, so on anything that honours that
 * none of this runs and the audio arrives already resampled by the platform.
 * Where it does run, it used to average each output sample over the three it
 * covered. A three-sample boxcar is a filter, but a poor one: it passes about
 * half of 10kHz and a third of 12kHz, which fold onto 6kHz and 4kHz - and the
 * one frequency its response does kill, near 16kHz, was the one the test
 * measured. What replaces it is an actual low-pass.
 */

/**
 * How far below 8kHz the anti-alias filter is placed.
 *
 * 6.8kHz, with the stopband reached by about 8.1kHz at the `TAPS` below.
 * Everything past 8kHz folds back into the speech when the rate is dropped to
 * 16kHz, so it has to be gone rather than merely reduced - and the band it
 * folds onto, 4-8kHz, is where the fricatives س, ش and ث are told apart.
 */
const ANTI_ALIAS_HZ = 6800;
/**
 * Filter length. Odd, so the delay is a whole number of samples.
 *
 * A Blackman window reaches its stopband in about 5.5/taps of the sample
 * rate, so 101 taps at 48kHz puts it ~2.6kHz above the cutoff: flat to
 * 5.5kHz, and better than 70dB down by the time aliasing would begin. The
 * cost is 101 multiply-adds per *output* sample, 1.6M a second, because a
 * decimator only has to evaluate the filter where it is about to sample.
 */
const TAPS = 101;

/** A windowed-sinc low pass at `ANTI_ALIAS_HZ`, normalised to unity gain. */
function lowPassTaps(inputRate: number): Float32Array {
  const taps = new Float32Array(TAPS);
  const half = (TAPS - 1) / 2;
  const cutoff = ANTI_ALIAS_HZ / inputRate;
  let sum = 0;
  for (let index = 0; index < TAPS; index += 1) {
    const at = index - half;
    const sinc =
      at === 0
        ? 2 * cutoff
        : Math.sin(2 * Math.PI * cutoff * at) / (Math.PI * at);
    /* Blackman: the widest transition of the usual windows, and the deepest
       stopband, which is the half that matters when the alternative is the
       signal folding on top of itself. */
    const window =
      0.42 -
      0.5 * Math.cos((2 * Math.PI * index) / (TAPS - 1)) +
      0.08 * Math.cos((4 * Math.PI * index) / (TAPS - 1));
    taps[index] = sinc * window;
    sum += taps[index]!;
  }
  for (let index = 0; index < TAPS; index += 1) taps[index]! /= sum;
  return taps;
}

/**
 * Resample a stream of microphone blocks to the rate the model expects.
 *
 * Stateful, and that is the point: the filter needs the samples either side
 * of the one it is producing, and the output position almost never lands on a
 * block boundary. Resampling each block alone discarded the fraction of a
 * sample left over - at 48kHz, one sample every 85ms, which is a dozen small
 * discontinuities a second fed to the feature extractor as if they were
 * speech. The tail and the fractional phase are carried instead.
 */
export function createPracticeResampler(
  inputRate: number,
): (input: Float32Array) => Float32Array {
  /*
   * A buffer per resampler, grown as needed and copied out at the size the
   * block actually produced.
   *
   * The length is not known in advance - it depends on where the fractional
   * phase lands - which is why this used to build a `number[]` and push. That
   * boxed every sample into a JS array, and both the level meter and the
   * recogniser then converted it back, so each block of audio was converted
   * three times on a path that runs several times a second for the length of
   * a page. One write and one copy now.
   */
  let scratch = new Float32Array(0);
  const room = (count: number) => {
    if (scratch.length < count) scratch = new Float32Array(count + 64);
    return scratch;
  };

  /* Copied, not passed through: `getChannelData` hands back a buffer the
     browser reuses, and callers keep what they are given. */
  if (inputRate === PRACTICE_SAMPLE_RATE) {
    return (input) => input.slice();
  }

  /*
   * Audio can arrive *below* 16kHz - a Bluetooth headset on its narrowband
   * voice profile gives 8kHz - and that was passed straight through. The
   * model reads whatever it is given as 16kHz, so an 8kHz block is a
   * recitation at double speed and an octave up, which is nothing it can
   * recognise. There is no detail to recover by interpolating, but there is a
   * tempo to preserve, and that is the difference between unusable and merely
   * muffled. Nothing needs filtering: the band is already narrower than the
   * output can represent.
   */
  if (inputRate < PRACTICE_SAMPLE_RATE) {
    const step = inputRate / PRACTICE_SAMPLE_RATE;
    let previous = 0;
    let phase = 0;
    return (input) => {
      const output = room(Math.ceil(input.length / step) + 1);
      let count = 0;
      let at = phase;
      while (at < input.length) {
        const lower = Math.floor(at);
        const fraction = at - lower;
        const before = lower === 0 ? previous : input[lower - 1]!;
        const after = input[lower]!;
        output[count] = before * (1 - fraction) + after * fraction;
        count += 1;
        at += step;
      }
      previous = input[input.length - 1] ?? previous;
      phase = at - input.length;
      return output.slice(0, count);
    };
  }

  const taps = lowPassTaps(inputRate);
  const half = (TAPS - 1) / 2;
  const step = inputRate / PRACTICE_SAMPLE_RATE;
  let tail = new Float32Array(0);
  /* The first output sits `half` samples in, which is the filter's own delay
     rather than anything thrown away. */
  let phase = half;

  /** The filter centred on `middle`; the caller guarantees it is in range. */
  const filtered = (stream: Float32Array, middle: number) => {
    let sum = 0;
    for (let index = 0; index < TAPS; index += 1) {
      sum += stream[middle - half + index]! * taps[index]!;
    }
    return sum;
  };

  return (input) => {
    const stream = new Float32Array(tail.length + input.length);
    stream.set(tail, 0);
    stream.set(input, tail.length);

    const output = room(Math.ceil(stream.length / step) + 1);
    let count = 0;
    let at = phase;
    /*
     * `at + 1 + half` because the output lands between two sample positions
     * and the filter is evaluated at both, then interpolated. The signal is
     * band-limited to 6.8kHz by then, so interpolating it is accurate - which
     * it would not be on the raw 48kHz input.
     */
    while (at + half + 1 < stream.length) {
      const base = Math.floor(at);
      const fraction = at - base;
      const before = filtered(stream, base);
      const after = filtered(stream, base + 1);
      output[count] = before * (1 - fraction) + after * fraction;
      count += 1;
      at += step;
    }

    /* Keep only what the next block still needs to see behind it. */
    const keep = Math.max(0, Math.floor(at) - half);
    tail = stream.slice(keep);
    phase = at - keep;
    return output.slice(0, count);
  };
}

function trimToWindow(samples: number[], maxSamples: number): number[] {
  if (samples.length <= maxSamples) return [...samples];
  return samples.slice(samples.length - maxSamples);
}

function abortError(): DOMException {
  return new DOMException("Microphone startup was cancelled", "AbortError");
}

/** Settles once `signal` aborts; never, without one. */
function whenAborted(signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) resolve();
    signal?.addEventListener("abort", () => resolve(), { once: true });
  });
}

/**
 * How long to wait for a suspended context to resume before giving up.
 *
 * Generous, because a resume that is going to work does so immediately: this
 * is only reached where it is never going to settle at all.
 */
const RESUME_TIMEOUT_MS = 4000;

function whenTimedOut(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rolling STT while speaking; final buffer after a short pause. */
export async function startPhraseMicCapture(
  callbacks: PhraseMicCallbacks,
  options: PhraseMicCaptureOptions = {},
): Promise<MicCaptureHandle> {
  if (options.signal?.aborted) throw abortError();

  /*
   * All three of these are tuned for a conference call, where the point is to
   * make every voice in the room audible and even. That is the opposite of
   * what a recitation check wants. Automatic gain in particular is how a
   * brother talking across the room gets lifted to the same level as the
   * reciter the moment the reciter pauses for breath; noise suppression and
   * echo cancellation both reshape sustained vowels, which is most of
   * recitation. The model was trained on plain microphone audio.
   */
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });

  if (options.signal?.aborted) {
    stream.getTracks().forEach((track) => track.stop());
    throw abortError();
  }

  let audioContext: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let stopped = false;
  /* While the app is making a noise of its own; see `muteFor`. */
  let mutedUntil = 0;
  const isMutedRef = () => performance.now() < mutedUntil;
  const muteFor = (milliseconds: number) => {
    mutedUntil = Math.max(mutedUntil, performance.now() + milliseconds);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    options.signal?.removeEventListener("abort", stop);
    callbacks.onLevelChange?.(0);
    callbacks.onSpeakingChange?.(false);
    processor?.disconnect();
    source?.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    if (audioContext) void audioContext.close();
  };

  try {
    try {
      // Asking for the model's rate lets the platform resample properly,
      // instead of this file approximating it afterwards.
      audioContext = new AudioContext({ sampleRate: PRACTICE_SAMPLE_RATE });
      source = audioContext.createMediaStreamSource(stream);
    } catch {
      /*
       * Firefox will not connect a microphone to a context running at any
       * rate but the device's own, and throws NotSupportedError - so the
       * request that lets Chrome resample for us stopped تسميع starting on
       * Firefox at all. Fall back to the device's rate and resample each
       * block here instead, which is what `resampleToPracticeRate` is for.
       */
      void audioContext?.close();
      audioContext = new AudioContext();
      source = audioContext.createMediaStreamSource(stream);
    }
    processor = audioContext.createScriptProcessor(4096, 1, 1);

    const minPhraseSamples = Math.floor(
      (PRACTICE_MIN_SPEECH_MS / 1000) * PRACTICE_SAMPLE_RATE,
    );
    const maxPhraseSamples = Math.floor(
      (PRACTICE_MAX_PHRASE_MS / 1000) * PRACTICE_SAMPLE_RATE,
    );
    const silenceSamplesNeeded = Math.floor(
      (PRACTICE_SILENCE_MS / 1000) * PRACTICE_SAMPLE_RATE,
    );
    const rollingWindowSamples = Math.floor(
      (PRACTICE_ROLLING_WINDOW_MS / 1000) * PRACTICE_SAMPLE_RATE,
    );
    const minRollingSamples = Math.floor(
      (PRACTICE_MIN_ROLLING_MS / 1000) * PRACTICE_SAMPLE_RATE,
    );
    const rollingChunkSamples = Math.floor(
      (PRACTICE_ROLLING_CHUNK_MS / 1000) * PRACTICE_SAMPLE_RATE,
    );

    const gate = createSpeechGate();
    /* One for the whole run: the filter needs the samples either side of the
       one it produces, and the output rarely lands on a block boundary. */
    const resample = createPracticeResampler(audioContext.sampleRate);
    /* Diagnostics are cumulative over the run; a momentary reading says
       nothing about whether a microphone is usable. */
    let peak = 0;
    let clipped = 0;
    let samplesSeen = 0;
    let blocks = 0;
    let accepted = 0;
    let lastReport = 0;
    // `getTracks` rather than `getAudioTracks`: the request was audio-only,
    // and this is the accessor the rest of this file already uses.
    const deviceLabel = stream.getTracks()[0]?.label ?? "";

    const reportDiagnostics = (now: number) => {
      if (!callbacks.onDiagnostics) return;
      // Four times a second is enough to read and cheap to compute.
      if (now - lastReport < 250) return;
      lastReport = now;
      callbacks.onDiagnostics({
        deviceLabel,
        contextSampleRate: audioContext?.sampleRate ?? 0,
        peak,
        clippedShare: samplesSeen === 0 ? 0 : clipped / samplesSeen,
        acceptedShare: blocks === 0 ? 0 : accepted / blocks,
        blocks,
      });
    };

    const phraseBuffer: number[] = [];
    const rollingBuffer: number[] = [];
    let speaking = false;
    let silenceSamples = 0;
    let samplesSinceRollingEmit = 0;
    let lastSpeaking = false;

    const notifySpeaking = (next: boolean) => {
      if (next === lastSpeaking) return;
      lastSpeaking = next;
      callbacks.onSpeakingChange?.(next);
    };

    /* Nothing buffers phrases for a listener that is not there; see
       `onPhrase`. The streaming path takes `onAudioBlock` and neither. */
    const wantsPhrases = Boolean(
      callbacks.onPhrase ?? callbacks.onRollingChunk,
    );

    const keepRolling = (block: Float32Array) => {
      rollingBuffer.push(...block);
      const trimmed = trimToWindow(rollingBuffer, rollingWindowSamples);
      rollingBuffer.length = 0;
      rollingBuffer.push(...trimmed);
    };

    const emitRollingChunk = () => {
      if (!callbacks.onRollingChunk) return;
      if (rollingBuffer.length < minRollingSamples) return;
      callbacks.onRollingChunk(new Float32Array(rollingBuffer));
      samplesSinceRollingEmit = 0;
    };

    const flushPhrase = () => {
      if (callbacks.onPhrase && phraseBuffer.length >= minPhraseSamples) {
        callbacks.onPhrase(new Float32Array(phraseBuffer));
      }
      phraseBuffer.length = 0;
      rollingBuffer.length = 0;
      speaking = false;
      silenceSamples = 0;
      samplesSinceRollingEmit = 0;
      notifySpeaking(false);
    };

    processor.onaudioprocess = (event) => {
      if (stopped) return;
      /*
       * Muted means the microphone is not listened to at all.
       *
       * Treating these blocks as non-speech was not the same thing: they
       * still went into the phrase buffer, beep and all, and still counted
       * towards the silence that ends a phrase - so a mute shorter than the
       * silence threshold could flush a phrase in the middle of a word, with
       * the sound effect inside it. Dropping them outright also keeps the
       * beep out of the speech gate's noise floor and off the level meter.
       */
      if (isMutedRef()) return;
      const input = event.inputBuffer.getChannelData(0);
      const block = resample(input);

      const blockRms = computeRms(block);
      callbacks.onLevelChange?.(
        Math.min(1, blockRms / MIC_LEVEL_REFERENCE_RMS),
      );
      /* How long this block really was, which is not fixed: see the gate. */
      const blockSeconds = input.length / audioContext!.sampleRate;
      const isSpeech = acceptSpeech(gate, blockRms, blockSeconds);

      /* Measured on the resampled block, which is what the model receives. */
      blocks += 1;
      if (isSpeech) accepted += 1;
      for (const sample of block) {
        const level = Math.abs(sample);
        if (level > peak) peak = level;
        if (level >= 0.99) clipped += 1;
      }
      samplesSeen += block.length;
      reportDiagnostics(event.timeStamp);

      if (isSpeech) {
        callbacks.onAudioBlock?.(block);
        speaking = true;
        silenceSamples = 0;
        notifySpeaking(true);
        if (wantsPhrases) {
          phraseBuffer.push(...block);
          keepRolling(block);
          samplesSinceRollingEmit += block.length;
          if (samplesSinceRollingEmit >= rollingChunkSamples) {
            emitRollingChunk();
          }
        }
      } else if (speaking) {
        if (wantsPhrases) {
          phraseBuffer.push(...block);
          keepRolling(block);
        }
        silenceSamples += block.length;
        if (silenceSamples >= silenceSamplesNeeded) {
          emitRollingChunk();
          flushPhrase();
          return;
        }
      }

      if (speaking && wantsPhrases && phraseBuffer.length >= maxPhraseSamples) {
        emitRollingChunk();
        flushPhrase();
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    /*
     * A context created outside a user gesture starts suspended, and a
     * suspended context never calls onaudioprocess - the microphone is open,
     * the bar says it is listening, and no audio ever arrives. The gesture
     * that started the run has long expired by the time the model has
     * finished loading, so the context has to be resumed explicitly.
     *
     * Listening for the abort first, and not waiting past it: on Safari a
     * resume without a fresh gesture can stay pending for good, and a stop
     * pressed meanwhile reached nothing - the microphone stayed on and the
     * start never settled.
     *
     * And not waiting past `RESUME_TIMEOUT_MS` either. Racing the abort alone
     * still left the reader with a bar that said it was listening and no
     * audio, no error and nothing to do but press stop: a resume that never
     * settles has to be reported as a failure, not waited on.
     */
    options.signal?.addEventListener("abort", stop, { once: true });
    if (audioContext.state === "suspended") {
      await Promise.race([
        audioContext.resume(),
        whenAborted(options.signal),
        whenTimedOut(RESUME_TIMEOUT_MS),
      ]);
    }

    if (options.signal?.aborted) {
      stop();
      throw abortError();
    }
    if (audioContext.state === "suspended") {
      stop();
      throw new Error("The microphone could not be started");
    }
    return { stop, muteFor };
  } catch (error) {
    stop();
    throw error;
  }
}
