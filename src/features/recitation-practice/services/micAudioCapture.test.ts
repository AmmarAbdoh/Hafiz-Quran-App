// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { startPhraseMicCapture } from "./micAudioCapture";

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
});
