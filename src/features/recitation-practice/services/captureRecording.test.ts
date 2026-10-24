import { afterEach, describe, expect, it, vi } from "vitest";
import { saveRecording, type RecordingMeta } from "./captureRecording";

const meta: RecordingMeta = {
  verseKeys: ["1:1"],
  expected: [{ locations: ["1:1:1"], units: ["بِ", "س", "مِ"] }],
  progressIndex: 1,
  totalWords: 4,
  stoppedShort: true,
  misreadLocations: [],
  stumbles: [{ location: "1:1:2", heard: ["رَ", "بِ"] }],
  skippedLocations: ["1:1:2"],
  held: [{ locations: ["1:1:1"], ms: 900 }],
  heard: [["بِ", 0.9, 0.04]],
  strictMode: false,
  recordedAt: "2026-10-22T10:00:00.000Z",
  note: "stopped after the first word",
};

/** The reader in scripts/tasmee/lib/audio.mjs, so the two must agree. */
function readWavAsFloat32(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer);
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (id === "data") {
      const samples = new Float32Array(size / 2);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = view.getInt16(offset + 8 + index * 2, true) / 32768;
      }
      return samples;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("no data chunk");
}

describe("keeping a recorded run", () => {
  afterEach(() => vi.unstubAllGlobals());

  interface SentBody {
    id: string;
    wav: string;
    meta: RecordingMeta;
  }

  const capture = async (samples: Float32Array) => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const name = await saveRecording(samples, 16_000, meta);
    const sent = fetchMock.mock.calls[0]![1]!.body;
    const body = JSON.parse(sent as string) as SentBody;
    return { name, body };
  };

  /*
   * The whole point of the capture: `scripts/tasmee` has to be able to read
   * it back. That reader walks the RIFF chunks and expects 16-bit mono.
   */
  it("writes a wav the bench can read, at the model's rate", async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);

    const { body } = await capture(samples);
    const bytes = Uint8Array.from(atob(body.wav), (c) => c.charCodeAt(0));
    const view = new DataView(bytes.buffer);

    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
    expect(view.getUint16(22, true)).toBe(1); // one channel
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16); // bits per sample

    const read = readWavAsFloat32(bytes);
    expect(read.length).toBe(samples.length);
    for (let index = 0; index < samples.length; index += 1) {
      expect(read[index]).toBeCloseTo(samples[index]!, 3);
    }
  });

  /* A sample past ±1 wraps to the opposite sign as an integer: a click. */
  it("clamps a sample louder than the format can hold", async () => {
    const { body } = await capture(new Float32Array([2, -2]));
    const bytes = Uint8Array.from(atob(body.wav), (c) => c.charCodeAt(0));

    const read = readWavAsFloat32(bytes);
    expect(read[0]).toBeGreaterThan(0.99);
    expect(read[1]).toBeLessThan(-0.99);
  });

  it("sends the note and what the run did, under a name of its own", async () => {
    const { name, body } = await capture(new Float32Array([0.1]));

    expect(name).toMatch(/^recorded-.*\.wav$/);
    expect(body.id).not.toContain("/");
    expect(body.meta.note).toBe("stopped after the first word");
    expect(body.meta.skippedLocations).toEqual(["1:1:2"]);
    expect(body.meta.stoppedShort).toBe(true);
  });

  it("reports what the dev server said when it refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response("recording too large", { status: 413 }),
        ),
    );

    await expect(
      saveRecording(new Float32Array([0.1]), 16_000, meta),
    ).rejects.toThrow("recording too large");
  });
});
