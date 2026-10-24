// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPracticeResampler,
  startPhraseMicCapture,
} from "./micAudioCapture";

afterEach(() => {
  vi.unstubAllGlobals();
});

function installAudioCaptureEnvironment() {
  const stopTrack = vi.fn();
  const stream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });

  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const processor = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null as ScriptProcessorNode["onaudioprocess"],
  };
  const close = vi.fn().mockResolvedValue(undefined);
  const destination = {} as AudioDestinationNode;

  class FakeAudioContext {
    readonly destination = destination;
    readonly sampleRate = 16_000;
    readonly createMediaStreamSource = vi.fn(
      () => source as unknown as MediaStreamAudioSourceNode,
    );
    readonly createScriptProcessor = vi.fn(
      () => processor as unknown as ScriptProcessorNode,
    );
    readonly close = close;
  }

  vi.stubGlobal("AudioContext", FakeAudioContext);

  const emit = (samples: Float32Array) => {
    expect(processor.onaudioprocess).not.toBeNull();
    processor.onaudioprocess!.call(
      {} as ScriptProcessorNode,
      {
        inputBuffer: {
          getChannelData: () => samples,
        },
      } as unknown as AudioProcessingEvent,
    );
  };

  return { close, destination, emit, processor, source, stopTrack };
}

describe("startPhraseMicCapture", () => {
  it("releases a stream obtained after startup was cancelled", async () => {
    let resolveStream!: (stream: MediaStream) => void;
    const streamPromise = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => streamPromise) },
    });

    const controller = new AbortController();
    const capture = startPhraseMicCapture(
      { onPhrase: vi.fn() },
      { signal: controller.signal },
    );
    controller.abort();
    resolveStream({
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream);

    await expect(capture).rejects.toMatchObject({ name: "AbortError" });
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  it("surfaces microphone permission failures", async () => {
    const denied = new DOMException("denied", "NotAllowedError");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(denied) },
    });

    await expect(startPhraseMicCapture({ onPhrase: vi.fn() })).rejects.toBe(
      denied,
    );
  });

  it("emits a phrase after speech is followed by the configured pause", async () => {
    const environment = installAudioCaptureEnvironment();
    const onPhrase = vi.fn();
    const onRollingChunk = vi.fn();
    const onSpeakingChange = vi.fn();
    const onLevelChange = vi.fn();
    const controller = new AbortController();

    const capture = await startPhraseMicCapture(
      { onPhrase, onRollingChunk, onSpeakingChange, onLevelChange },
      { signal: controller.signal },
    );

    expect(environment.source.connect).toHaveBeenCalledWith(
      environment.processor,
    );
    expect(environment.processor.connect).toHaveBeenCalledWith(
      environment.destination,
    );

    environment.emit(new Float32Array(4096).fill(0.1));
    environment.emit(new Float32Array(4096));
    environment.emit(new Float32Array(4096));

    expect(onSpeakingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSpeakingChange).toHaveBeenNthCalledWith(2, false);
    expect(onPhrase).toHaveBeenCalledOnce();
    expect(onPhrase.mock.calls[0]?.[0]).toBeInstanceOf(Float32Array);
    expect(onPhrase.mock.calls[0]?.[0]).toHaveLength(12_288);
    expect(onRollingChunk).toHaveBeenCalledOnce();
    expect(onLevelChange).toHaveBeenCalledWith(1);
    expect(onLevelChange).toHaveBeenLastCalledWith(0);

    controller.abort();
    expect(environment.processor.disconnect).toHaveBeenCalledOnce();
    expect(environment.source.disconnect).toHaveBeenCalledOnce();
    expect(environment.stopTrack).toHaveBeenCalledOnce();
    expect(environment.close).toHaveBeenCalledOnce();

    capture.stop();
    expect(environment.stopTrack).toHaveBeenCalledOnce();
  });

  it("flushes a long phrase and keeps rolling recognition bounded", async () => {
    const environment = installAudioCaptureEnvironment();
    const onPhrase = vi.fn();
    const onRollingChunk = vi.fn();
    const onSpeakingChange = vi.fn();
    const capture = await startPhraseMicCapture({
      onPhrase,
      onRollingChunk,
      onSpeakingChange,
    });

    for (let block = 0; block < 32; block += 1) {
      environment.emit(new Float32Array(4096).fill(0.1));
    }

    expect(onPhrase).toHaveBeenCalledOnce();
    expect(onPhrase.mock.calls[0]?.[0]).toHaveLength(131_072);
    expect(onRollingChunk.mock.calls.length).toBeGreaterThan(1);
    for (const [samples] of onRollingChunk.mock.calls) {
      const chunk = samples as Float32Array;
      expect(chunk.length).toBeLessThanOrEqual(35_200);
    }
    expect(onSpeakingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSpeakingChange).toHaveBeenLastCalledWith(false);

    capture.stop();
  });

  it("cleans up the acquired stream when audio setup fails", async () => {
    const stopTrack = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopTrack }],
        }),
      },
    });
    const setupFailure = new Error("audio context unavailable");
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw setupFailure;
        }
      },
    );

    await expect(startPhraseMicCapture({ onPhrase: vi.fn() })).rejects.toBe(
      setupFailure,
    );
    expect(stopTrack).toHaveBeenCalledOnce();
  });

  /*
   * Firefox throws NotSupportedError when a microphone is connected to a
   * context running at any rate but the device's own, so asking for 16kHz
   * stopped تسميع starting there at all.
   */
  it("falls back to the device's rate where the browser will not resample", async () => {
    const environment = installAudioCaptureEnvironment();
    const closed: number[] = [];
    vi.stubGlobal(
      "AudioContext",
      class {
        readonly destination = environment.destination;
        readonly sampleRate: number;
        constructor(options?: AudioContextOptions) {
          this.sampleRate = options?.sampleRate ?? 48_000;
        }
        readonly createMediaStreamSource = () => {
          if (this.sampleRate !== 48_000) {
            throw new DOMException(
              "different sample-rate",
              "NotSupportedError",
            );
          }
          return environment.source as unknown as MediaStreamAudioSourceNode;
        };
        readonly createScriptProcessor = () =>
          environment.processor as unknown as ScriptProcessorNode;
        readonly close = () => {
          closed.push(this.sampleRate);
          return Promise.resolve();
        };
      },
    );
    const onAudioBlock = vi.fn();

    const capture = await startPhraseMicCapture({
      onPhrase: vi.fn(),
      onAudioBlock,
    });
    environment.emit(new Float32Array(4096).fill(0.1));

    expect(closed).toEqual([16_000]);
    // Brought down to the model's rate here instead.
    /* 1365 is 4096 at a third of the rate; the first block is short by the
       anti-alias filter's own latency, which the next block makes up. */
    expect(onAudioBlock.mock.calls[0]?.[0]).toHaveLength(1332);
    capture.stop();
  });

  it("releases the microphone when stopped while the context waits to resume", async () => {
    const environment = installAudioCaptureEnvironment();
    vi.stubGlobal(
      "AudioContext",
      class {
        readonly destination = environment.destination;
        readonly sampleRate = 16_000;
        readonly state = "suspended";
        // Safari, without a fresh gesture: the promise never settles.
        readonly resume = () => new Promise<void>(() => {});
        readonly createMediaStreamSource = () =>
          environment.source as unknown as MediaStreamAudioSourceNode;
        readonly createScriptProcessor = () =>
          environment.processor as unknown as ScriptProcessorNode;
        readonly close = environment.close;
      },
    );
    const controller = new AbortController();

    const capture = startPhraseMicCapture(
      { onPhrase: vi.fn() },
      { signal: controller.signal },
    );
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();

    await expect(capture).rejects.toMatchObject({ name: "AbortError" });
    expect(environment.stopTrack).toHaveBeenCalledOnce();
  });
});

/*
 * The defect this guards: the capture used to take every third sample of
 * 48kHz audio with no filter, which folds everything above 8kHz back down on
 * top of the speech. The model was being fed that as if it were clean.
 */
describe("bringing microphone audio down to the model's rate", () => {
  const RATE = 48_000;

  /** A quarter second of `hz`, at the device's rate. */
  function tone(hz: number, rate = RATE): Float32Array {
    const samples = new Float32Array(rate / 4);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((2 * Math.PI * hz * index) / rate);
    }
    return samples;
  }

  /** How much of `hz` is present in a 16kHz signal. */
  function energyAt(samples: ArrayLike<number>, hz: number): number {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < samples.length; index += 1) {
      const angle = (2 * Math.PI * hz * index) / 16_000;
      real += samples[index]! * Math.cos(angle);
      imaginary += samples[index]! * Math.sin(angle);
    }
    return Math.hypot(real, imaginary) / samples.length;
  }

  /*
   * Where each of these folds to, once the rate is 16kHz: 10kHz onto 6kHz,
   * 12kHz onto 4kHz, 15kHz onto 1kHz. The boxcar that used to do this passed
   * about half of the first and a third of the second straight into the band
   * the fricatives س, ش and ث are told apart in. Only 15kHz was ever tested,
   * and that is the one frequency a three-sample average happens to kill.
   */
  it.each([
    [10_000, 6_000],
    [12_000, 4_000],
    [15_000, 1_000],
  ])("keeps %ihz from folding onto %ihz", (played, folded) => {
    const resampled = createPracticeResampler(RATE)(tone(played));

    expect(energyAt(resampled, folded)).toBeLessThan(0.01);
  });

  /* And does not take the voice with it: 1kHz has to come through intact. */
  it("leaves the speech band alone", () => {
    const resampled = createPracticeResampler(RATE)(tone(1_000));

    expect(energyAt(resampled, 1_000)).toBeGreaterThan(0.45);
  });

  /*
   * A block at a time, which is how the microphone delivers it. 4096 input
   * samples are 1365.33 output samples, and resampling each block alone threw
   * the third of a sample away every time - a dozen discontinuities a second,
   * handed to the feature extractor as if they were speech.
   */
  it("drops no samples at a block boundary", () => {
    const resample = createPracticeResampler(RATE);
    const blocks = 30;
    const block = new Float32Array(4096);

    let produced = 0;
    for (let index = 0; index < blocks; index += 1) {
      produced += resample(block).length;
    }

    /* 30 blocks of 1365.33 is 40,960; all that is missing is the filter's
       one-off latency, rather than a third of a sample thirty times. */
    expect(produced).toBeGreaterThan((4096 * blocks) / 3 - 40);
    expect(produced).toBeLessThanOrEqual((4096 * blocks) / 3);
  });

  it("passes audio through untouched when it already arrives at the rate", () => {
    const already = new Float32Array([0.1, -0.2, 0.3]);

    expect(Array.from(createPracticeResampler(16_000)(already))).toEqual(
      Array.from(already),
    );
  });

  /*
   * A Bluetooth headset on its narrowband voice profile gives 8kHz. The model
   * reads whatever it is given as 16kHz, so passing that through unchanged is
   * a recitation at double speed and an octave up.
   */
  it("stretches audio that arrives below the rate back to the right tempo", () => {
    const resampled = createPracticeResampler(8_000)(tone(400, 8_000));

    expect(resampled.length).toBe(4_000);
    expect(energyAt(resampled, 400)).toBeGreaterThan(0.4);
  });
});
