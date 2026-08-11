import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findActiveWordLocation,
  fetchSurahAudioMeta,
  fetchVerseAudioData,
  mergeWordSegments,
  parseSegmentRow,
  type WordSegment,
} from "./quranComAudio";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseSegmentRow", () => {
  it("parses verse API 4-tuple segments", () => {
    expect(parseSegmentRow([0, 1, 130, 1130])).toEqual({
      position: 1,
      startMs: 130,
      endMs: 1130,
    });
  });

  it("parses chapter API 3-tuple segments", () => {
    expect(parseSegmentRow([1, 0, 6275])).toEqual({
      position: 1,
      startMs: 0,
      endMs: 6275,
    });
  });

  it.each([
    { row: [] },
    { row: [1] },
    { row: [1, 2] },
    { row: [0, "bad", 10, 20] },
    { row: [0, 1, "bad", 20] },
    { row: [0, 1, 10, "bad"] },
    { row: ["bad", 10, 20] },
    { row: [1, "bad", 20] },
    { row: [1, 10, "bad"] },
  ])("rejects malformed segment row %#", ({ row }) => {
    expect(parseSegmentRow(row as unknown as number[])).toBeNull();
  });
});

describe("findActiveWordLocation", () => {
  const segments: WordSegment[] = [
    { position: 6, startMs: 6040, endMs: 7430, location: "3:85:6" },
    { position: 7, startMs: 7440, endMs: 8270, location: "3:85:7" },
    { position: 6, startMs: 15000, endMs: 16400, location: "3:85:6" },
  ];

  it("returns the active word for the current time", () => {
    expect(findActiveWordLocation(segments, 7000)).toBe("3:85:6");
    expect(findActiveWordLocation(segments, 7800)).toBe("3:85:7");
  });

  it("prefers a later repeat of the same word position", () => {
    expect(findActiveWordLocation(segments, 15500)).toBe("3:85:6");
  });

  it("returns null outside every segment", () => {
    expect(findActiveWordLocation(segments, 9000)).toBeNull();
  });

  it("prefers the shortest segment when overlapping segments start together", () => {
    expect(
      findActiveWordLocation(
        [
          { position: 1, startMs: 10, endMs: 100, location: "1:1:1" },
          { position: 2, startMs: 10, endMs: 50, location: "1:1:2" },
        ],
        20,
      ),
    ).toBe("1:1:2");
  });
});

describe("mergeWordSegments", () => {
  it("adds chapter repeat segments without dropping verse timings", () => {
    const words = new Map<number, string>([[6, "3:85:6"]]);
    const verseSegments: WordSegment[] = [
      { position: 6, startMs: 6040, endMs: 7430, location: "3:85:6" },
    ];

    const merged = mergeWordSegments(
      verseSegments,
      [{ position: 6, startMs: 15000, endMs: 16400 }],
      words,
    );

    expect(merged).toHaveLength(2);
    expect(merged[1]?.startMs).toBe(15000);
  });

  it("skips unknown and duplicate chapter segments and sorts ties by position", () => {
    const words = new Map<number, string>([
      [1, "1:1:1"],
      [2, "1:1:2"],
    ]);
    const verseSegments: WordSegment[] = [
      { position: 2, startMs: 100, endMs: 200, location: "1:1:2" },
    ];

    expect(
      mergeWordSegments(
        verseSegments,
        [
          { position: 3, startMs: 0, endMs: 10 },
          { position: 2, startMs: 100, endMs: 200 },
          { position: 1, startMs: 100, endMs: 150 },
        ],
        words,
      ),
    ).toEqual([
      { position: 1, startMs: 100, endMs: 150, location: "1:1:1" },
      { position: 2, startMs: 100, endMs: 200, location: "1:1:2" },
    ]);
  });
});

describe("fetchVerseAudioData", () => {
  it("returns null for an unsuccessful response or missing audio", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ verse: { verse_key: "1:1" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchVerseAudioData("1:1", 7)).resolves.toBeNull();
    await expect(fetchVerseAudioData("1:1", 7)).resolves.toBeNull();
  });

  it("maps valid word segments and forwards cancellation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        verse: {
          verse_key: "1:1",
          words: [
            { position: 1, location: "1:1:1", char_type_name: "word" },
            { position: 2, location: "1:1:2", char_type_name: "word" },
            { position: 3, location: "1:1:3", char_type_name: "end" },
          ],
          audio: {
            url: "recitations/7/1.mp3",
            segments: [[0, 1, 10, 20], [2, 20, 30], [0, 9, 30, 40], [1]],
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(
      fetchVerseAudioData("1:1", 7, controller.signal),
    ).resolves.toEqual({
      audioUrl: "https://audio.qurancdn.com/recitations/7/1.mp3",
      segments: [
        { position: 1, startMs: 10, endMs: 20, location: "1:1:1" },
        { position: 2, startMs: 20, endMs: 30, location: "1:1:2" },
      ],
      wordsByPosition: new Map([
        [1, "1:1:1"],
        [2, "1:1:2"],
      ]),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("verses/by_key/1%3A1"),
      { signal: controller.signal },
    );
  });

  it("supports audio responses without words or segments", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          verse: { verse_key: "1:1", audio: { url: "audio.mp3" } },
        }),
      }),
    );

    await expect(fetchVerseAudioData("1:1", 1)).resolves.toEqual({
      audioUrl: "https://audio.qurancdn.com/audio.mp3",
      segments: [],
      wordsByPosition: new Map(),
    });
  });
});

describe("fetchSurahAudioMeta", () => {
  it("returns null for an unsuccessful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(fetchSurahAudioMeta(1, 7)).resolves.toBeNull();
  });

  it("normalizes mixed chapter segment formats", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        audio_file: {
          timestamps: [
            {
              verse_key: "2:3",
              timestamp_from: 1000,
              timestamp_to: 2000,
              duration: 1000,
              segments: [
                [0, 1, 900, 1100],
                [3, 1200],
                [0, 4, 1500, 1700],
                [5, 1800],
                ["bad", 1900],
                [0, 2, 2100, 2200],
                [1],
              ],
            },
            {
              verse_key: "2:4",
              timestamp_from: 2000,
              timestamp_to: 2500,
              duration: 500,
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await expect(fetchSurahAudioMeta(2, 7, controller.signal)).resolves.toEqual(
      {
        surahDurationMs: 2500,
        ayahTimestamps: [
          {
            verseKey: "2:3",
            ayah: 3,
            startMs: 1000,
            endMs: 2000,
            durationMs: 1000,
            chapterSegments: [
              { position: 1, startMs: 0, endMs: 100 },
              { position: 3, startMs: 200, endMs: 500 },
              { position: 4, startMs: 500, endMs: 700 },
              { position: 5, startMs: 800, endMs: 1100 },
            ],
          },
          {
            verseKey: "2:4",
            ayah: 4,
            startMs: 2000,
            endMs: 2500,
            durationMs: 500,
            chapterSegments: [],
          },
        ],
      },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("chapter_recitations/7/2?segments=true"),
      { signal: controller.signal },
    );
  });

  it("handles an empty timestamp response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ audio_file: {} }),
      }),
    );

    await expect(fetchSurahAudioMeta(1, 1)).resolves.toEqual({
      surahDurationMs: 0,
      ayahTimestamps: [],
    });
  });
});
