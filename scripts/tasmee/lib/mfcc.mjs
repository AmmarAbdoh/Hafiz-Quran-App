/*
 * MFCC features, written out rather than pulled from a package.
 *
 * The whole point of the DTW approach is that it owes nothing to anybody -
 * no model, no weights, no licence - so taking a dependency to compute its
 * features would be odd. This is the standard pipeline: pre-emphasis, frame,
 * window, FFT, mel filterbank, log, DCT.
 */

const SAMPLE_RATE = 16000;
const FRAME_MS = 25;
const HOP_MS = 10;
const FFT_SIZE = 512;
const MEL_BANDS = 26;
/** The first coefficient is overall loudness, which says nothing about words. */
const KEEP_COEFFS = 13;
const PRE_EMPHASIS = 0.97;

function hann(length) {
  const window = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
  }
  return window;
}

/** In-place iterative radix-2 FFT. `size` must be a power of two. */
function fft(real, imag) {
  const size = real.length;

  for (let i = 1, j = 0; i < size; i += 1) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= size; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    for (let i = 0; i < size; i += len) {
      let curReal = 1;
      let curImag = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const aReal = real[i + k];
        const aImag = imag[i + k];
        const bReal =
          real[i + k + len / 2] * curReal - imag[i + k + len / 2] * curImag;
        const bImag =
          real[i + k + len / 2] * curImag + imag[i + k + len / 2] * curReal;
        real[i + k] = aReal + bReal;
        imag[i + k] = aImag + bImag;
        real[i + k + len / 2] = aReal - bReal;
        imag[i + k + len / 2] = aImag - bImag;
        const nextReal = curReal * wReal - curImag * wImag;
        curImag = curReal * wImag + curImag * wReal;
        curReal = nextReal;
      }
    }
  }
}

const hzToMel = (hz) => 2595 * Math.log10(1 + hz / 700);
const melToHz = (mel) => 700 * (10 ** (mel / 2595) - 1);

function melFilterbank(bands, fftSize, sampleRate) {
  const bins = fftSize / 2 + 1;
  const lowMel = hzToMel(80);
  const highMel = hzToMel(sampleRate / 2);
  const points = Array.from({ length: bands + 2 }, (_, i) =>
    Math.floor(
      ((fftSize + 1) *
        melToHz(lowMel + ((highMel - lowMel) * i) / (bands + 1))) /
        sampleRate,
    ),
  );

  return Array.from({ length: bands }, (_, band) => {
    const filter = new Float32Array(bins);
    const [left, centre, right] = [
      points[band],
      points[band + 1],
      points[band + 2],
    ];
    for (let bin = left; bin < centre; bin += 1) {
      if (centre > left) filter[bin] = (bin - left) / (centre - left);
    }
    for (let bin = centre; bin < right; bin += 1) {
      if (right > centre) filter[bin] = (right - bin) / (right - centre);
    }
    return filter;
  });
}

const FILTERS = melFilterbank(MEL_BANDS, FFT_SIZE, SAMPLE_RATE);
const WINDOW = hann(Math.round((FRAME_MS * SAMPLE_RATE) / 1000));

/**
 * One MFCC vector per 10ms of audio.
 *
 * Each vector is mean-and-variance normalised across the whole clip, which is
 * the cheap way to take out most of what is the speaker rather than the
 * words - the recording level, the microphone, some of the voice.
 */
export function mfcc(samples) {
  const frameLength = WINDOW.length;
  const hop = Math.round((HOP_MS * SAMPLE_RATE) / 1000);
  const frames = [];

  const emphasised = new Float32Array(samples.length);
  emphasised[0] = samples[0];
  for (let i = 1; i < samples.length; i += 1) {
    emphasised[i] = samples[i] - PRE_EMPHASIS * samples[i - 1];
  }

  for (let start = 0; start + frameLength <= emphasised.length; start += hop) {
    const real = new Float64Array(FFT_SIZE);
    const imag = new Float64Array(FFT_SIZE);
    for (let i = 0; i < frameLength; i += 1) {
      real[i] = emphasised[start + i] * WINDOW[i];
    }
    fft(real, imag);

    const power = new Float64Array(FFT_SIZE / 2 + 1);
    for (let bin = 0; bin < power.length; bin += 1) {
      power[bin] = (real[bin] * real[bin] + imag[bin] * imag[bin]) / FFT_SIZE;
    }

    const logEnergies = FILTERS.map((filter) => {
      let sum = 0;
      for (let bin = 0; bin < filter.length; bin += 1)
        sum += filter[bin] * power[bin];
      return Math.log(sum + 1e-10);
    });

    // DCT-II, dropping coefficient 0 (loudness).
    const coeffs = new Float32Array(KEEP_COEFFS);
    for (let k = 1; k <= KEEP_COEFFS; k += 1) {
      let sum = 0;
      for (let n = 0; n < MEL_BANDS; n += 1) {
        sum += logEnergies[n] * Math.cos((Math.PI * k * (n + 0.5)) / MEL_BANDS);
      }
      coeffs[k - 1] = sum;
    }
    frames.push(coeffs);
  }

  return normalise(frames);
}

function normalise(frames) {
  if (frames.length === 0) return frames;
  const dims = frames[0].length;

  for (let d = 0; d < dims; d += 1) {
    let mean = 0;
    for (const frame of frames) mean += frame[d];
    mean /= frames.length;

    let variance = 0;
    for (const frame of frames) variance += (frame[d] - mean) ** 2;
    const deviation = Math.sqrt(variance / frames.length) || 1;

    for (const frame of frames) frame[d] = (frame[d] - mean) / deviation;
  }
  return frames;
}
