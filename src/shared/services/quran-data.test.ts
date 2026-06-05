import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildFullWordLines,
  clearQuranDataCache,
  getPageLines,
  getPageSurahHeaderInfo,
  getSurahHeaderLines,
  getVerseInfo,
  getPrevAndNextVerse,
  getRandomVerse,
} from "./quran-data";
import type {
  MushafPageLayout,
  MushafVerse,
  UthmaniVerse,
  VerseInfoRecord,
} from "@/shared/types/quran";

const mockRecords: VerseInfoRecord[] = [
  {
    id: 1,
    verse_number: 1,
    verse_key: "1:1",
    hizb_number: 1,
    rub_el_hizb_number: 1,
    ruku_number: 1,
    manzil_number: 1,
    sajdah_number: null,
    page_number: 1,
    juz_number: 1,
  },
];

const mockVerses: UthmaniVerse[] = [
  { id: 1, verse_key: "1:1", text_uthmani: "آية 1" },
  { id: 2, verse_key: "1:2", text_uthmani: "آية 2" },
  { id: 3, verse_key: "2:1", text_uthmani: "آية 3" },
];

beforeEach(() => {
  clearQuranDataCache();
  vi.restoreAllMocks();
});

describe("getVerseInfo", () => {
  it("returns formatted verse metadata", () => {
    const info = getVerseInfo(1, mockRecords);
    expect(info).toHaveLength(5);
    expect(info[0]?.key).toBe("اسم السورة");
    expect(info[0]?.value).toBe("الفاتحة");
    expect(info[1]?.value).toBe(1);
  });

  it("returns empty array for unknown verse", () => {
    expect(getVerseInfo(999, mockRecords)).toEqual([]);
  });
});

describe("getPrevAndNextVerse", () => {
  it("returns prev and next within same surah", () => {
    const [prev, next] = getPrevAndNextVerse(mockVerses[1]!, mockVerses);
    expect(prev?.id).toBe(1);
    expect(next).toBeNull();
  });

  it("returns null prev for first verse in surah", () => {
    const [prev, next] = getPrevAndNextVerse(mockVerses[0]!, mockVerses);
    expect(prev).toBeNull();
    expect(next?.id).toBe(2);
  });
});

describe("getPageLines", () => {
  const sampleVerses: MushafVerse[] = [
    {
      id: 1,
      jozz: 1,
      page: 1,
      sura_no: 1,
      sura_name_en: "Al-Fatiha",
      sura_name_ar: "الفاتحة",
      line_start: 2,
      line_end: 2,
      aya_no: 1,
      aya_text: "بسم الله",
      aya_text_emlaey: "بسم الله",
    },
    {
      id: 2,
      jozz: 1,
      page: 1,
      sura_no: 1,
      sura_name_en: "Al-Fatiha",
      sura_name_ar: "الفاتحة",
      line_start: 3,
      line_end: 3,
      aya_no: 2,
      aya_text: "الحمد لله",
      aya_text_emlaey: "الحمد لله",
    },
    {
      id: 3,
      jozz: 1,
      page: 1,
      sura_no: 1,
      sura_name_en: "Al-Fatiha",
      sura_name_ar: "الفاتحة",
      line_start: 4,
      line_end: 4,
      aya_no: 3,
      aya_text: "الرحمن",
      aya_text_emlaey: "الرحمن",
    },
    {
      id: 4,
      jozz: 1,
      page: 1,
      sura_no: 1,
      sura_name_en: "Al-Fatiha",
      sura_name_ar: "الفاتحة",
      line_start: 4,
      line_end: 4,
      aya_no: 4,
      aya_text: "مالك",
      aya_text_emlaey: "مالك",
    },
  ];

  it("groups verses by line_start", () => {
    const lines = getPageLines(sampleVerses);
    expect(lines).toHaveLength(15);
    expect(lines[1]?.verses).toHaveLength(1);
    expect(lines[3]?.verses).toHaveLength(2);
  });

  it("calculates surah header lines", () => {
    expect(getSurahHeaderLines(sampleVerses)).toBe(1);
  });
});

describe("buildFullWordLines", () => {
  const pageLayout: MushafPageLayout = {
    page: 41,
    lines: [
      {
        line: 8,
        words: [
          {
            verse_key: "2:249",
            sura: 2,
            aya: 249,
            word: 60,
            location: "2:249:60",
            line: 8,
            page: 41,
            code_v2: "ﱻ",
            char_type: "word",
          },
          {
            verse_key: "2:249",
            sura: 2,
            aya: 249,
            word: 61,
            location: "2:249:61",
            line: 8,
            page: 41,
            code_v2: "ﱼ",
            char_type: "end",
          },
          {
            verse_key: "2:250",
            sura: 2,
            aya: 250,
            word: 1,
            location: "2:250:1",
            line: 8,
            page: 41,
            code_v2: "ﱽ",
            char_type: "word",
          },
        ],
      },
    ],
  };

  it("fills sparse lines into a 15-line mushaf page", () => {
    const lines = buildFullWordLines(pageLayout);
    expect(lines).toHaveLength(15);
    expect(lines[7]?.words).toHaveLength(3);
    expect(lines[0]?.words).toHaveLength(0);
  });

  it("detects surah header lines at page start", () => {
    const headerPage: MushafPageLayout = {
      page: 2,
      lines: [
        {
          line: 3,
          words: [
            {
              verse_key: "2:1",
              sura: 2,
              aya: 1,
              word: 1,
              location: "2:1:1",
              line: 3,
              page: 2,
              code_v2: "ﱁ",
              char_type: "word",
            },
          ],
        },
      ],
    };

    expect(getPageSurahHeaderInfo(headerPage)).toEqual({
      show: true,
      surahNumber: 2,
      headerLines: 2,
    });
  });
});

describe("getRandomVerse", () => {
  it("fetches from correct chapter path", async () => {
    const mockVerse = { id: 1, verse_key: "1:1", text_uthmani: "test" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ verses: [mockVerse] }),
      }),
    );

    const result = await getRandomVerse("surah", [1]);
    expect(result).toEqual(mockVerse);
    expect(fetch).toHaveBeenCalledWith(
      "/data/quran/Chapters_Uthmani/chapter_1.json",
    );
  });

  it("returns null for empty indices", async () => {
    expect(await getRandomVerse("surah", [])).toBeNull();
  });
});
