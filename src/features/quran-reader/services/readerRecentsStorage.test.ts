// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/shared/storage";
import { loadReaderRecents, recordReaderRecent } from "./readerRecentsStorage";

const MAX_RECENTS = 10;

function writeRaw(value: string): void {
  localStorage.setItem(STORAGE_KEYS.readerRecents, value);
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recording where the reader has been", () => {
  it("keeps a visit across a reload", () => {
    recordReaderRecent({ path: "/quran/page/3", label: "صفحة ٣", page: 3 });

    expect(loadReaderRecents()).toEqual([
      {
        schemaVersion: 1,
        path: "/quran/page/3",
        label: "صفحة ٣",
        page: 3,
        visitedAt: Date.parse("2026-01-01T00:00:00Z"),
      },
    ]);
  });

  it("puts the most recent first", () => {
    recordReaderRecent({ path: "/quran/page/3", label: "three" });
    recordReaderRecent({ path: "/quran/page/4", label: "four" });

    expect(loadReaderRecents().map((entry) => entry.path)).toEqual([
      "/quran/page/4",
      "/quran/page/3",
    ]);
  });

  /*
   * Revisiting a page should move it to the top rather than add a second
   * entry, or a reader going back and forth fills the whole list with one
   * page.
   */
  it("moves a revisited page up instead of repeating it", () => {
    recordReaderRecent({ path: "/quran/page/3", label: "three" });
    recordReaderRecent({ path: "/quran/page/4", label: "four" });
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z"));
    recordReaderRecent({ path: "/quran/page/3", label: "three again" });

    const recents = loadReaderRecents();
    expect(recents.map((entry) => entry.path)).toEqual([
      "/quran/page/3",
      "/quran/page/4",
    ]);
    expect(recents[0]).toMatchObject({
      label: "three again",
      visitedAt: Date.parse("2026-01-02T00:00:00Z"),
    });
  });

  it("remembers only the last ten", () => {
    for (let page = 1; page <= MAX_RECENTS + 5; page += 1) {
      recordReaderRecent({ path: `/quran/page/${page}`, label: `p${page}` });
    }

    const recents = loadReaderRecents();
    expect(recents).toHaveLength(MAX_RECENTS);
    expect(recents[0]?.path).toBe("/quran/page/15");
    expect(recents.at(-1)?.path).toBe("/quran/page/6");
  });

  it("returns the new list, so a caller need not read it back", () => {
    const returned = recordReaderRecent({
      path: "/quran/surah/2",
      label: "البقرة",
    });

    expect(returned).toEqual(loadReaderRecents());
  });

  it("carries a surah and ayah when the visit had them", () => {
    recordReaderRecent({
      path: "/quran/surah/2/ayah/255",
      label: "البقرة ٢٥٥",
      surah: 2,
      ayah: 255,
    });

    expect(loadReaderRecents()[0]).toMatchObject({ surah: 2, ayah: 255 });
  });
});

describe("storage that cannot be trusted", () => {
  it("starts empty rather than throwing on unparseable data", () => {
    writeRaw("{ not json");

    expect(loadReaderRecents()).toEqual([]);
  });

  it("ignores a stored value that is not a list", () => {
    writeRaw(JSON.stringify({ path: "/quran/page/3" }));

    expect(loadReaderRecents()).toEqual([]);
  });

  /*
   * A bad entry drops out and its neighbours survive - unlike the bookmark
   * store, where one bad key rejects the whole list.
   */
  it("drops a malformed entry and keeps the rest", () => {
    writeRaw(
      JSON.stringify([
        { schemaVersion: 1, path: "/quran/page/3", label: "ok", visitedAt: 1 },
        { schemaVersion: 1, label: "no path", visitedAt: 2 },
        { schemaVersion: 2, path: "/quran/page/9", label: "old", visitedAt: 3 },
      ]),
    );

    expect(loadReaderRecents().map((entry) => entry.path)).toEqual([
      "/quran/page/3",
    ]);
  });

  it("refuses a path that is not in the app", () => {
    writeRaw(
      JSON.stringify([
        {
          schemaVersion: 1,
          path: "https://example.test/evil",
          label: "off site",
          visitedAt: 1,
        },
      ]),
    );

    expect(loadReaderRecents()).toEqual([]);
  });

  it("writes over a rejected store rather than failing forever", () => {
    writeRaw("{ not json");

    recordReaderRecent({ path: "/quran/page/3", label: "three" });

    expect(loadReaderRecents().map((entry) => entry.path)).toEqual([
      "/quran/page/3",
    ]);
  });
});
