// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/shared/storage";
import {
  isBookmarked,
  listBookmarks,
  removeBookmark,
  saveBookmark,
} from "./bookmarkStorage";

function writeRaw(value: string): void {
  localStorage.setItem(STORAGE_KEYS.bookmarks, value);
}

beforeEach(() => {
  localStorage.clear();
});

describe("saving and reading back", () => {
  it("keeps a bookmark across a reload", () => {
    expect(saveBookmark("2:255")).toBe(true);

    expect(listBookmarks()).toEqual(["2:255"]);
    expect(isBookmarked("2:255")).toBe(true);
  });

  it("puts the newest first, which is the order the list is read in", () => {
    saveBookmark("1:1");
    saveBookmark("2:255");
    saveBookmark("112:1");

    expect(listBookmarks()).toEqual(["112:1", "2:255", "1:1"]);
  });

  it("saving the same ayah twice leaves one bookmark", () => {
    saveBookmark("2:255");
    saveBookmark("2:255");

    expect(listBookmarks()).toEqual(["2:255"]);
  });

  it("removes one without disturbing the others", () => {
    saveBookmark("1:1");
    saveBookmark("2:255");

    expect(removeBookmark("1:1")).toBe(true);
    expect(listBookmarks()).toEqual(["2:255"]);
  });

  it("removing one that was never there changes nothing", () => {
    saveBookmark("2:255");

    expect(removeBookmark("1:1")).toBe(true);
    expect(listBookmarks()).toEqual(["2:255"]);
  });

  it("hands out a copy, so a caller cannot edit the stored list", () => {
    saveBookmark("2:255");

    listBookmarks().push("9:9");

    expect(listBookmarks()).toEqual(["2:255"]);
  });
});

describe("what counts as an ayah", () => {
  it("accepts a padded reference and stores it plainly", () => {
    expect(saveBookmark("002:255")).toBe(true);
    expect(listBookmarks()).toEqual(["2:255"]);
    expect(isBookmarked("2:255")).toBe(true);
  });

  it("ignores surrounding whitespace", () => {
    expect(saveBookmark("  2:255  ")).toBe(true);
    expect(listBookmarks()).toEqual(["2:255"]);
  });

  /*
   * Validated against the real ayah count of the surah, not just the shape.
   * Al-Baqarah has 286 ayat and Al-Fatihah 7, so 2:287 and 1:8 are not ayat
   * however well formed they look.
   */
  it.each([
    ["0:1", "surah before the first"],
    ["115:1", "surah past the last"],
    ["2:0", "ayah before the first"],
    ["2:287", "past the end of Al-Baqarah"],
    ["1:8", "past the end of Al-Fatihah"],
    ["114:7", "past the end of An-Nas"],
    ["2", "no ayah"],
    ["2:", "empty ayah"],
    ["two:255", "not a number"],
    ["", "empty"],
  ])("refuses %s (%s)", (verseKey) => {
    expect(saveBookmark(verseKey)).toBe(false);
    expect(isBookmarked(verseKey)).toBe(false);
    expect(listBookmarks()).toEqual([]);
  });

  it("accepts the last ayah of a surah", () => {
    expect(saveBookmark("2:286")).toBe(true);
    expect(saveBookmark("114:6")).toBe(true);
  });
});

describe("storage that cannot be trusted", () => {
  it("starts empty rather than throwing on unparseable data", () => {
    writeRaw("{ not json");

    expect(listBookmarks()).toEqual([]);
  });

  it("ignores a store of the wrong shape", () => {
    writeRaw(JSON.stringify({ schemaVersion: 1, keys: "2:255" }));

    expect(listBookmarks()).toEqual([]);
  });

  it("ignores entries that are not ayah references", () => {
    writeRaw(JSON.stringify({ schemaVersion: 1, keys: ["2:255", "nonsense"] }));

    expect(listBookmarks()).toEqual([]);
  });

  it("writes over a rejected store rather than failing forever", () => {
    writeRaw("{ not json");

    expect(saveBookmark("2:255")).toBe(true);
    expect(listBookmarks()).toEqual(["2:255"]);
  });

  /*
   * Worth knowing before anything else copies this file: a store written by a
   * different schema version is DISCARDED, not migrated. For bookmarks that
   * costs a short list. For a record of what someone has memorised it would
   * be the whole thing, so that one has to migrate rather than reset.
   */
  it("discards a store from another schema version", () => {
    writeRaw(JSON.stringify({ schemaVersion: 2, keys: ["2:255"] }));

    expect(listBookmarks()).toEqual([]);
  });
});
