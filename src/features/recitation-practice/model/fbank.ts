/*
 * Kaldi-compatible 80-dimensional log-mel filterbank.
 *
 * The zipformer's card is blunt about this: "The features must be kaldi
 * fbank, not a mel-spectrogram: a slaney-mel front end roughly doubles the
 * error rate." The two differ in several small ways that each look harmless
 * - the mel formula, whether the filters are area-normalised, the window
 * shape, whether a DC offset is removed, where pre-emphasis happens - and
 * together they are the difference between a model that works and one that
 * does not.
 *
 * So this follows Kaldi's compute-fbank-feats exactly rather than
 * approximately, and every constant below is Kaldi's default for it.
 */

/** 25ms at 16kHz. */
const FRAME_LENGTH = 400;
/** 10ms at 16kHz; four of these make one 40ms encoder frame. */
const FRAME_SHIFT = 160;
/** Kaldi rounds the window up to a power of two before the transform. */
const FFT_SIZE = 512;
const NUM_MEL_BINS = 80;
const LOW_FREQ = 20;
const PREEMPHASIS = 0.97;
/** Kaldi floors the filterbank energy at the float epsilon before the log. */
const ENERGY_FLOOR = 1.1920928955078125e-7;

const melScale = (hz: number) => 1127 * Math.log(1 + hz / 700);

/**
 * Povey window: a Hann window raised to 0.85.
 *
 * Kaldi's own default for fbank, and not interchangeable with plain Hann or
 * Hamming - it is slightly narrower, which changes every bin a little.
 */
function poveyWindow(length: number): Float64Array {
  const window = new Float64Array(length);
  for (let i = 0; i < length; i += 1) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
    window[i] = Math.pow(hann, 0.85);
  }
  return window;
}

/**
 * Triangular filters laid out evenly in mel, as Kaldi builds them.
 *
 * Not area-normalised: Kaldi leaves the triangles at unit peak, where
 * torchaudio's slaney scale divides by the filter width. That single
 * difference tilts the whole spectrum.
 */
function melBanks(sampleRate: number): Float64Array[] {
  const numFftBins = FFT_SIZE / 2;
  const fftBinWidth = sampleRate / FFT_SIZE;
  const highFreq = sampleRate / 2;
  const melLow = melScale(LOW_FREQ);
  const melHigh = melScale(highFreq);
  const melDelta = (melHigh - melLow) / (NUM_MEL_BINS + 1);

  const banks: Float64Array[] = [];
  for (let bin = 0; bin < NUM_MEL_BINS; bin += 1) {
    const leftMel = melLow + bin * melDelta;
    const centerMel = melLow + (bin + 1) * melDelta;
    const rightMel = melLow + (bin + 2) * melDelta;
    const weights = new Float64Array(numFftBins);
    for (let i = 0; i < numFftBins; i += 1) {
      const mel = melScale(fftBinWidth * i);
      if (mel <= leftMel || mel >= rightMel) continue;
      weights[i] =
        mel <= centerMel
          ? (mel - leftMel) / (centerMel - leftMel)
          : (rightMel - mel) / (rightMel - centerMel);
    }
    banks.push(weights);
  }
  return banks;
}

/** In-place iterative radix-2 FFT over separate real and imaginary parts. */
function fftInPlace(real: Float64Array, imag: Float64Array): void {
  const n = real.length;

  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tempReal = real[i]!;
      const tempImag = imag[i]!;
      real[i] = real[j]!;
      imag[i] = imag[j]!;
      real[j] = tempReal;
      imag[j] = tempImag;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    const half = len / 2;

    for (let i = 0; i < n; i += len) {
      let curReal = 1;
      let curImag = 0;

      for (let k = 0; k < half; k += 1) {
        const top = i + k;
        const bottom = top + half;
        const aReal = real[top]!;
        const aImag = imag[top]!;
        const cReal = real[bottom]!;
        const cImag = imag[bottom]!;
        const bReal = cReal * curReal - cImag * curImag;
        const bImag = cReal * curImag + cImag * curReal;

        real[top] = aReal + bReal;
        imag[top] = aImag + bImag;
        real[bottom] = aReal - bReal;
        imag[bottom] = aImag - bImag;

        const nextReal = curReal * stepReal - curImag * stepImag;
        curImag = curReal * stepImag + curImag * stepReal;
        curReal = nextReal;
      }
    }
  }
}

/**
 * Turn 16kHz mono samples into frames of 80 log-mel energies.
 *
 * Returns a flat Float32Array of `frames * 80`, which is the layout the
 * encoder's `x` input wants.
 */
export interface FbankResult {
  /** `frameCount * 80` log-mel energies, laid out frame by frame. */
  features: Float32Array;
  frameCount: number;
  dim: number;
}

/** See the note in `computeFbank`: constant for the only rate it accepts. */
let cachedWindow: Float64Array | null = null;
let cachedBanks: Float64Array[] | null = null;

export function computeFbank(
  samples: Float32Array | ArrayLike<number>,
  sampleRate = 16000,
): FbankResult {
  if (sampleRate !== 16000) {
    throw new Error(`fbank expects 16kHz audio, got ${sampleRate}`);
  }

  /*
   * Built once, not per block.
   *
   * Both depend only on constants - the guard above is what makes that safe,
   * since 16kHz is the only rate this accepts - and this function runs on
   * every block of microphone audio, where it was rebuilding a 400-point
   * window and 80 mel filters each time.
   */
  const window = (cachedWindow ??= poveyWindow(FRAME_LENGTH));
  const banks = (cachedBanks ??= melBanks(sampleRate));
  // snip_edges: only whole frames, no padding at either end.
  const frameCount =
    samples.length < FRAME_LENGTH
      ? 0
      : 1 + Math.floor((samples.length - FRAME_LENGTH) / FRAME_SHIFT);
  const features = new Float32Array(frameCount * NUM_MEL_BINS);

  const real = new Float64Array(FFT_SIZE);
  const imag = new Float64Array(FFT_SIZE);
  const frame = new Float64Array(FRAME_LENGTH);
  const power = new Float64Array(FFT_SIZE / 2 + 1);

  for (let f = 0; f < frameCount; f += 1) {
    const start = f * FRAME_SHIFT;

    let sum = 0;
    for (let i = 0; i < FRAME_LENGTH; i += 1) {
      frame[i] = samples[start + i] as number;
      sum += frame[i]!;
    }

    // Kaldi's order, which is not the obvious one: offset, then pre-emphasis,
    // then the window. Windowing first would taper the signal the
    // pre-emphasis filter is about to differentiate.
    const mean = sum / FRAME_LENGTH;
    for (let i = 0; i < FRAME_LENGTH; i += 1) frame[i]! -= mean;

    // The first sample is its own predecessor, as in Kaldi's Preemphasize.
    for (let i = FRAME_LENGTH - 1; i > 0; i -= 1) {
      frame[i]! -= PREEMPHASIS * frame[i - 1]!;
    }
    frame[0]! -= PREEMPHASIS * frame[0]!;

    real.fill(0);
    imag.fill(0);
    for (let i = 0; i < FRAME_LENGTH; i += 1) real[i] = frame[i]! * window[i]!;

    fftInPlace(real, imag);

    for (let i = 0; i <= FFT_SIZE / 2; i += 1) {
      power[i] = real[i]! * real[i]! + imag[i]! * imag[i]!;
    }

    const offset = f * NUM_MEL_BINS;
    for (let bin = 0; bin < NUM_MEL_BINS; bin += 1) {
      const weights = banks[bin]!;
      let energy = 0;
      for (let i = 0; i < weights.length; i += 1) {
        if (weights[i] !== 0) energy += weights[i]! * power[i]!;
      }
      features[offset + bin] = Math.log(Math.max(energy, ENERGY_FLOOR));
    }
  }

  return { features, frameCount, dim: NUM_MEL_BINS };
}
