import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECITER_ID,
  RECITERS,
  getReciterById,
  getRecitersByCategory,
} from "./reciters";

describe("getReciterById", () => {
  it("returns a configured reciter by its current id", () => {
    const configured = RECITERS.find(
      (reciter) => reciter.id === DEFAULT_RECITER_ID,
    );

    expect(getReciterById(DEFAULT_RECITER_ID)).toBe(configured);
  });

  it("migrates legacy short ids to their configured reciters", () => {
    expect(getReciterById("alafasy")).toMatchObject({
      id: "ea-Alafasy_128kbps",
      folder: "Alafasy_128kbps",
    });
  });

  it("migrates an old EveryAyah bitrate through its stable English name", () => {
    expect(getReciterById("ea-Alafasy_64kbps")).toMatchObject({
      id: "ea-Alafasy_128kbps",
      nameEn: "Alafasy",
    });
  });

  it.each(["unknown", "ea-unknown_folder"])(
    "falls back to the default for unsupported id %s",
    (id) => {
      expect(getReciterById(id).id).toBe(DEFAULT_RECITER_ID);
    },
  );
});

describe("getRecitersByCategory", () => {
  it("groups every configured reciter into one labelled category", () => {
    const groups = getRecitersByCategory();

    expect(groups.map((group) => group.category)).toEqual([
      "hafs",
      "warsh",
      "translation",
    ]);
    expect(groups.every((group) => group.label.length > 0)).toBe(true);
    expect(groups.flatMap((group) => group.reciters)).toHaveLength(
      RECITERS.length,
    );
    for (const group of groups) {
      expect(group.reciters.length).toBeGreaterThan(0);
      expect(
        group.reciters.every((reciter) => reciter.category === group.category),
      ).toBe(true);
    }
  });
});
