import { describe, expect, it } from "vitest";
import {
  buildFullWordLines,
  buildMushafPageItemsForSurah,
  buildSurahNameIndex,
} from "./mushafLayout";
import type { MushafPageLayout, MushafVerse } from "./types";

const pageLayout: MushafPageLayout = {
  page: 599,
  lines: [
    {
      line: 2,
      words: [
        {
          verse_key: "100:1",
          sura: 100,
          aya: 1,
          word: 1,
          location: "100:1:1",
          line: 2,
          page: 599,
          code_v2: "ﱁ",
          char_type: "word",
        },
      ],
    },
    {
      line: 8,
      words: [
        {
          verse_key: "101:1",
          sura: 101,
          aya: 1,
          word: 1,
          location: "101:1:1",
          line: 8,
          page: 599,
          code_v2: "ﱂ",
          char_type: "word",
        },
      ],
    },
  ],
};

describe("Mushaf layout model", () => {
  it("expands sparse data without changing source words", () => {
    const lines = buildFullWordLines(pageLayout);

    expect(lines).toHaveLength(15);
    expect(lines[1]?.words[0]?.location).toBe("100:1:1");
    expect(lines[7]?.words[0]?.location).toBe("101:1:1");
  });

  it("filters a page to one surah and retains its heading", () => {
    const items = buildMushafPageItemsForSurah(pageLayout, 101);

    expect(items.map((item) => item.type)).toEqual(["surah-header", "line"]);
    expect(items[0]).toMatchObject({ surahNumber: 101, headerLines: 1 });
  });

  it("builds one Arabic name per surah from core metadata", () => {
    const verses = [
      {
        sura_no: 100,
        sura_name_ar: "العَادِيات",
      },
      {
        sura_no: 100,
        sura_name_ar: "العَادِيات",
      },
    ] as MushafVerse[];

    expect(buildSurahNameIndex(verses)).toEqual(new Map([[100, "العَادِيات"]]));
  });
});
