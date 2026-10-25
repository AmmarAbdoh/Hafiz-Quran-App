import { describe, expect, it } from "vitest";
import type { SurahTimestamp } from "@/domain/quran";
import {
  computeSessionTime,
  formatClock,
  playlistIndexAt,
} from "./playbackTime";

function timestamps(
  entries: Array<[surah: number, ayah: number, durationMs: number]>,
): Map<number, SurahTimestamp[]> {
  const map = new Map<number, SurahTimestamp[]>();
  for (const [surah, ayah, durationMs] of entries) {
    const list = map.get(surah) ?? [];
    list.push({
      verseKey: `${surah}:${ayah}`,
      ayah,
      startMs: 0,
      endMs: durationMs,
      durationMs,
      chapterSegments: [],
    });
    map.set(surah, list);
  }
  return map;
}

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [7_000, "0:07"],
    [67_000, "1:07"],
    [600_000, "10:00"],
  ])("formats %ims as %s", (ms, expected) => {
    expect(formatClock(ms, "en")).toBe(expected);
  });

  it("grows an hours field only once it is needed", () => {
    expect(formatClock(3_599_000, "en")).toBe("59:59");
    expect(formatClock(3_600_000, "en")).toBe("1:00:00");
  });

  /*
   * Mapped digit by digit rather than run through Intl, which drops the
   * leading zero and leaves the clock jittering between "١:٧" and "١:١٧".
   */
  it("uses Arabic-Indic digits in Arabic, keeping the padding", () => {
    expect(formatClock(67_000, "ar")).toBe("١:٠٧");
    expect(formatClock(7_000, "ar")).toBe("٠:٠٧");
  });

  it("never shows a negative clock", () => {
    expect(formatClock(-5_000, "en")).toBe("0:00");
  });
});

describe("computeSessionTime", () => {
  const playlist = [
    { surah: 1, ayah: 1 },
    { surah: 1, ayah: 2 },
    { surah: 1, ayah: 3 },
  ];
  const known = timestamps([
    [1, 1, 4_000],
    [1, 2, 6_000],
    [1, 3, 5_000],
  ]);

  it("adds the ayat already played to the position in this one", () => {
    expect(
      computeSessionTime({
        playlist,
        index: 1,
        ayahMs: 2_000,
        timestamps: known,
      }),
    ).toEqual({ sessionMs: 6_000, sessionTotalMs: 15_000 });
  });

  it("totals the whole session, not just what has played", () => {
    expect(
      computeSessionTime({ playlist, index: 0, ayahMs: 0, timestamps: known })
        .sessionTotalMs,
    ).toBe(15_000);
  });

  /*
   * Everyayah recitations publish no per-ayah timings. Reporting a total
   * built from the few that are known would show a bar that races to the end
   * and stops - worse than showing no bar.
   */
  it("gives up entirely when one ayah has no published duration", () => {
    const partial = timestamps([
      [1, 1, 4_000],
      [1, 3, 5_000],
    ]);
    expect(
      computeSessionTime({
        playlist,
        index: 0,
        ayahMs: 0,
        timestamps: partial,
      }),
    ).toEqual({ sessionMs: null, sessionTotalMs: null });
  });

  it("has nothing to say about an empty playlist", () => {
    expect(
      computeSessionTime({
        playlist: [],
        index: 0,
        ayahMs: 0,
        timestamps: known,
      }),
    ).toEqual({ sessionMs: null, sessionTotalMs: null });
  });

  it("does not run past the end when an ayah overruns its published length", () => {
    expect(
      computeSessionTime({
        playlist,
        index: 2,
        ayahMs: 99_000,
        timestamps: known,
      }).sessionMs,
    ).toBe(15_000);
  });
});

describe("where a tap on the progress line lands", () => {
  const playlist = [
    { surah: 2, ayah: 1 },
    { surah: 2, ayah: 2 },
    { surah: 2, ayah: 3 },
  ];

  /* 2:1 is short and 2:2 long, so time and count disagree on purpose. */
  const timed = timestamps([
    [2, 1, 1_000],
    [2, 2, 8_000],
    [2, 3, 1_000],
  ]);

  it("goes by running time when every ayah's length is known", () => {
    expect(playlistIndexAt({ playlist, fraction: 0, timestamps: timed })).toBe(
      0,
    );
    expect(
      playlistIndexAt({ playlist, fraction: 0.05, timestamps: timed }),
    ).toBe(0);
    /* A third of the way is well inside the long second ayah. */
    expect(
      playlistIndexAt({ playlist, fraction: 0.34, timestamps: timed }),
    ).toBe(1);
    expect(
      playlistIndexAt({ playlist, fraction: 0.85, timestamps: timed }),
    ).toBe(1);
    expect(
      playlistIndexAt({ playlist, fraction: 0.95, timestamps: timed }),
    ).toBe(2);
    expect(playlistIndexAt({ playlist, fraction: 1, timestamps: timed })).toBe(
      2,
    );
  });

  it("goes by ayah count when a length is missing", () => {
    const partial = timestamps([[2, 1, 1_000]]);
    expect(
      playlistIndexAt({ playlist, fraction: 0.34, timestamps: partial }),
    ).toBe(1);
    expect(
      playlistIndexAt({ playlist, fraction: 0.7, timestamps: partial }),
    ).toBe(2);
    expect(
      playlistIndexAt({ playlist, fraction: 1, timestamps: partial }),
    ).toBe(2);
  });

  it("stays inside the playlist whatever it is given", () => {
    expect(playlistIndexAt({ playlist, fraction: -1, timestamps: timed })).toBe(
      0,
    );
    expect(playlistIndexAt({ playlist, fraction: 3, timestamps: timed })).toBe(
      2,
    );
    expect(
      playlistIndexAt({ playlist: [], fraction: 0.5, timestamps: timed }),
    ).toBe(0);
  });
});
