import { describe, expect, it } from "vitest";
import {
  findActiveWordLocation,
  mergeWordSegments,
  parseSegmentRow,
  type WordSegment,
} from "@/shared/services/quran-com-audio";

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
});

describe("mergeWordSegments", () => {
  it("adds chapter repeat segments without dropping verse timings", () => {
    const words = new Map<number, string>([[6, "3:85:6"]]);
    const verseSegments: WordSegment[] = [
      { position: 6, startMs: 6040, endMs: 7430, location: "3:85:6" },
    ];

    const merged = mergeWordSegments(verseSegments, [
      { position: 6, startMs: 15000, endMs: 16400 },
    ], words);

    expect(merged).toHaveLength(2);
    expect(merged[1]?.startMs).toBe(15000);
  });
});
