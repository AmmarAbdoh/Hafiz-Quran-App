import { describe, expect, it } from "vitest";
import { getAyahAudioUrl, getWordAudioUrl } from "./audioUrls";
import type { ReciterOption } from "./reciters";

const everyAyahReciter: ReciterOption = {
  id: "test-everyayah",
  nameAr: "قارئ",
  nameEn: "Reciter",
  category: "hafs",
  source: "everyayah",
  folder: "Reciter_128kbps",
};

const islamicAppReciter: ReciterOption = {
  id: "test-islamic-app",
  nameAr: "ترجمة",
  nameEn: "Translation",
  category: "translation",
  source: "islamicapp",
  slug: "en.translation",
};

describe("getAyahAudioUrl", () => {
  it("builds a zero-padded EveryAyah URL", () => {
    expect(getAyahAudioUrl(everyAyahReciter, 2, 5)).toBe(
      "https://everyayah.com/data/Reciter_128kbps/002005.mp3",
    );
  });

  it("converts a surah-local ayah to the global islamic.app number", () => {
    expect(getAyahAudioUrl(islamicAppReciter, 2, 1)).toBe(
      "https://cdn.islamic.app/quran/audio/en.translation/8.mp3",
    );
    expect(getAyahAudioUrl(islamicAppReciter, 114, 6)).toBe(
      "https://cdn.islamic.app/quran/audio/en.translation/6236.mp3",
    );
  });

  it.each([
    { surah: 0, ayah: 1, message: "Invalid surah number: 0" },
    { surah: 115, ayah: 1, message: "Invalid surah number: 115" },
    { surah: 1, ayah: 0, message: "Invalid ayah number: 1:0" },
    { surah: 1, ayah: 8, message: "Invalid ayah number: 1:8" },
  ])("rejects an invalid Quran location %#", ({ surah, ayah, message }) => {
    expect(() => getAyahAudioUrl(islamicAppReciter, surah, ayah)).toThrow(
      message,
    );
  });

  it("rejects a reciter without a usable audio location", () => {
    expect(() =>
      getAyahAudioUrl(
        { ...islamicAppReciter, id: "missing-audio", slug: undefined },
        1,
        1,
      ),
    ).toThrow("Reciter missing-audio has no audio folder configured");
  });
});

describe("getWordAudioUrl", () => {
  it("builds a zero-padded Quran Foundation word URL", () => {
    expect(getWordAudioUrl(12, 3, 4)).toBe(
      "https://verses.quran.foundation/wbw/012_003_004.mp3",
    );
  });
});
