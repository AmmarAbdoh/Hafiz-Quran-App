// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "@/shared/storage";
import {
  getResumeReaderPath,
  loadReaderPosition,
  saveReaderPosition,
  subscribeReaderPosition,
} from "./readerPositionStorage";

function writeRaw(value: unknown): void {
  window.localStorage.setItem(
    STORAGE_KEYS.readerPosition,
    JSON.stringify(value),
  );
}

describe("readerPositionStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // Drop the snapshot cache so each case starts from stored state.
    loadReaderPosition();
  });

  it("returns the same snapshot until the stored value changes", () => {
    saveReaderPosition({ layout: "page", page: 12, surah: 2 });

    const first = loadReaderPosition();
    expect(first).not.toBeNull();
    expect(loadReaderPosition()).toBe(first);

    saveReaderPosition({ layout: "page", page: 13, surah: 2 });
    const second = loadReaderPosition();

    expect(second).not.toBe(first);
    expect(second?.page).toBe(13);
  });

  it("keeps the surah scroll offset when a route save omits it", () => {
    saveReaderPosition({
      layout: "surah",
      page: 20,
      surah: 3,
      scrollRatio: 0.42,
    });
    saveReaderPosition({ layout: "surah", page: 21, surah: 3 });

    expect(loadReaderPosition()?.scrollRatio).toBe(0.42);
  });

  it("drops the scroll offset when the surah changes", () => {
    saveReaderPosition({
      layout: "surah",
      page: 20,
      surah: 3,
      scrollRatio: 0.42,
    });
    saveReaderPosition({ layout: "surah", page: 30, surah: 4 });

    expect(loadReaderPosition()?.scrollRatio).toBeUndefined();
  });

  it("clamps an out-of-range stored page instead of resuming an invalid route", () => {
    writeRaw({
      schemaVersion: 1,
      layout: "page",
      page: 9999,
      surah: 1,
      updatedAt: Date.now(),
    });

    expect(loadReaderPosition()?.page).toBe(604);
    expect(getResumeReaderPath()).toBe("/quran/page/604");
  });

  it("upgrades a record stored before the schema was versioned", () => {
    writeRaw({ layout: "surah", page: 2, surah: 2, ayah: 5 });

    const migrated = loadReaderPosition();

    expect(migrated?.schemaVersion).toBe(1);
    expect(migrated?.surah).toBe(2);
    expect(getResumeReaderPath()).toBe("/quran/surah/2/ayah/5");
  });

  it("notifies subscribers when another tab moves the reading position", () => {
    let notified = 0;
    const unsubscribe = subscribeReaderPosition(() => {
      notified += 1;
    });

    writeRaw({
      schemaVersion: 1,
      layout: "page",
      page: 44,
      surah: 3,
      updatedAt: Date.now(),
    });
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEYS.readerPosition }),
    );

    expect(notified).toBe(1);
    expect(loadReaderPosition()?.page).toBe(44);

    unsubscribe();
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEYS.readerPosition }),
    );
    expect(notified).toBe(1);
  });

  it("ignores storage events for unrelated keys", () => {
    let notified = 0;
    const unsubscribe = subscribeReaderPosition(() => {
      notified += 1;
    });

    window.dispatchEvent(new StorageEvent("storage", { key: "theme" }));

    expect(notified).toBe(0);
    unsubscribe();
  });

  it("falls back to the first page when nothing is stored", () => {
    expect(loadReaderPosition()).toBeNull();
    expect(getResumeReaderPath()).toBe("/quran/page/1");
  });
});
