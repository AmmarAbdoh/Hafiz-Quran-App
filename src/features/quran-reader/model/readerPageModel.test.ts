import { describe, expect, it } from "vitest";
import type {
  MushafPageLayout,
  MushafVerse,
  VerseInfoRecord,
} from "@/domain/quran";
import {
  findVersePage,
  selectReaderMetadata,
  selectReaderRouteState,
  selectReaderSurahLayout,
} from "./readerPageModel";

const mushafData: MushafVerse[] = [
  makeVerse({ id: 1, page: 1, surah: 1, ayah: 1, name: "الفَاتِحَة" }),
  makeVerse({ id: 2, page: 2, surah: 2, ayah: 1, name: "البَقَرَة" }),
  makeVerse({ id: 3, page: 2, surah: 2, ayah: 2, name: "البَقَرَة" }),
  makeVerse({ id: 4, page: 3, surah: 2, ayah: 3, name: "البَقَرَة" }),
];

const verseInfoRecords: VerseInfoRecord[] = mushafData.map((verse) => ({
  id: verse.id,
  verse_number: verse.aya_no,
  verse_key: `${verse.sura_no}:${verse.aya_no}`,
  hizb_number: verse.page + 10,
  rub_el_hizb_number: 1,
  ruku_number: 1,
  manzil_number: 1,
  sajdah_number: null,
  page_number: verse.page,
  juz_number: verse.page,
}));

const pageLayouts: MushafPageLayout[] = [
  makePageLayout(2, "2:1"),
  makePageLayout(3, "2:3"),
];

describe("reader page selectors", () => {
  it("derives canonical page route state", () => {
    expect(
      selectReaderRouteState({
        pathname: "/quran/page/2",
        params: { pageNumber: "2" },
        mushafData,
        totalPages: 604,
      }),
    ).toEqual({
      routeContext: { type: "page", page: 2 },
      layoutMode: "page",
      currentPage: 2,
      currentSurahNumber: 2,
      currentSurahIndex: 1,
    });
  });

  it("keeps only loaded pages that contain the selected surah", () => {
    expect(selectReaderSurahLayout(mushafData, pageLayouts, 2, 604)).toEqual({
      pages: [2, 3],
      pageLayouts,
      bounds: { min: 2, max: 3 },
    });
  });

  it("derives page metadata without synchronizing local state", () => {
    expect(
      selectReaderMetadata({
        layoutMode: "page",
        currentPage: 2,
        currentSurahNumber: 2,
        visibleSurahPage: 2,
        mushafData,
        verseInfoRecords,
      }),
    ).toEqual({
      surahNames: ["البَقَرَة"],
      surahAyahCount: 3,
      juzNumber: 2,
      hizbNumber: 12,
    });
  });

  it("uses a verse from the visible surah page for surah metadata", () => {
    expect(
      selectReaderMetadata({
        layoutMode: "surah",
        currentPage: 2,
        currentSurahNumber: 2,
        visibleSurahPage: 3,
        mushafData,
        verseInfoRecords,
      }),
    ).toEqual({
      surahNames: ["البَقَرَة"],
      surahAyahCount: 3,
      juzNumber: 3,
    });
  });

  it("finds a verse page and rejects malformed verse keys", () => {
    expect(findVersePage(mushafData, "2:3")).toBe(3);
    expect(findVersePage(mushafData, "not-a-verse")).toBeNull();
  });
});

function makeVerse({
  id,
  page,
  surah,
  ayah,
  name,
}: {
  id: number;
  page: number;
  surah: number;
  ayah: number;
  name: string;
}): MushafVerse {
  return {
    id,
    jozz: page,
    page,
    sura_no: surah,
    sura_name_en: "Test",
    sura_name_ar: name,
    line_start: 1,
    line_end: 1,
    aya_no: ayah,
    aya_text: "نص",
    aya_text_emlaey: "نص",
  };
}

function makePageLayout(page: number, verseKey: string) {
  const [surah, ayah] = verseKey.split(":").map(Number);
  return {
    page,
    lines: [
      {
        line: 1,
        words: [
          {
            verse_key: verseKey,
            sura: surah!,
            aya: ayah!,
            word: 1,
            location: `${verseKey}:1`,
            line: 1,
            page,
            code_v2: "word",
            char_type: "word",
          },
        ],
      },
    ],
  };
}
