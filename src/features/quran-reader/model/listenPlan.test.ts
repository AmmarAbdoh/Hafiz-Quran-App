import type { MushafVerse } from "@/domain/quran";
import type {
  ListenPlan,
  ListenPreset,
} from "@/features/quran-reader/model/listenPlanTypes";
import {
  buildListenSession,
  defaultPlanFromPreset,
  validateListenPlan,
} from "./listenPlan";

function makeVerse(
  id: number,
  surah: number,
  ayah: number,
  page: number,
  juz = 1,
): MushafVerse {
  return {
    id,
    jozz: juz,
    page,
    sura_no: surah,
    sura_name_en: `Surah ${surah}`,
    sura_name_ar: `سورة ${surah}`,
    line_start: id,
    line_end: id,
    aya_no: ayah,
    aya_text: `آية ${ayah}`,
    aya_text_emlaey: `اية ${ayah}`,
  };
}

const verses: MushafVerse[] = [
  makeVerse(1, 1, 1, 1),
  makeVerse(2, 1, 2, 1),
  makeVerse(3, 2, 1, 2),
  makeVerse(4, 2, 2, 2),
  makeVerse(5, 2, 3, 3, 2),
];

const noRepeat = {
  repeatMode: "none" as const,
  repeatCount: 1,
};

describe("listen plan model", () => {
  it("keeps scope data semantic for localized presentation", () => {
    const plan = {
      scope: "ayah" as const,
      surah: 1,
      ayah: 1,
      repeatMode: "count" as const,
      repeatCount: 3,
    };

    expect(buildListenSession(plan, verses)).toEqual({
      playlist: [{ surah: 1, ayah: 1 }],
      repeatMode: "count",
      repeatCount: 3,
      repeatEachAyah: true,
      plan,
    });
  });

  it("returns stable validation codes instead of localized strings", () => {
    expect(
      validateListenPlan(
        {
          scope: "ayah",
          surah: 1,
          ayah: 99,
          repeatMode: "none",
          repeatCount: 1,
        },
        verses,
        604,
      ),
    ).toBe("invalidAyah");

    expect(
      validateListenPlan(
        {
          scope: "page-range",
          page: 4,
          endPage: 2,
          repeatMode: "none",
          repeatCount: 1,
        },
        verses,
        604,
      ),
    ).toBe("invalidPageRange");
  });

  it.each<{
    name: string;
    plan: ListenPlan;
    playlist: Array<{ surah: number; ayah: number }>;
  }>([
    {
      name: "an ayah range across surahs",
      plan: {
        scope: "ayah-range",
        surah: 1,
        ayah: 2,
        endSurah: 2,
        endAyah: 2,
        ...noRepeat,
      },
      playlist: [
        { surah: 1, ayah: 2 },
        { surah: 2, ayah: 1 },
        { surah: 2, ayah: 2 },
      ],
    },
    {
      name: "one page",
      plan: { scope: "page", page: 2, ...noRepeat },
      playlist: [
        { surah: 2, ayah: 1 },
        { surah: 2, ayah: 2 },
      ],
    },
    {
      name: "a page range",
      plan: {
        scope: "page-range",
        page: 1,
        endPage: 3,
        ...noRepeat,
      },
      playlist: [
        { surah: 1, ayah: 1 },
        { surah: 1, ayah: 2 },
        { surah: 2, ayah: 1 },
        { surah: 2, ayah: 2 },
        { surah: 2, ayah: 3 },
      ],
    },
    {
      name: "a surah starting from a later ayah",
      plan: { scope: "surah", surah: 2, ayah: 2, ...noRepeat },
      playlist: [
        { surah: 2, ayah: 2 },
        { surah: 2, ayah: 3 },
      ],
    },
    {
      name: "a juz",
      plan: { scope: "juz", juz: 1, ...noRepeat },
      playlist: [
        { surah: 1, ayah: 1 },
        { surah: 1, ayah: 2 },
        { surah: 2, ayah: 1 },
        { surah: 2, ayah: 2 },
      ],
    },
  ])("builds $name", ({ plan, playlist }) => {
    expect(buildListenSession(plan, verses)).toMatchObject({
      playlist,
      repeatEachAyah: false,
      plan,
    });
  });

  it("deduplicates repeated verse rows and clamps repeat counts", () => {
    const pageVerses = [verses[0]!, { ...verses[0]!, id: 99 }, verses[1]!];
    const plan: ListenPlan = {
      scope: "page",
      page: 1,
      repeatMode: "count",
      repeatCount: 0,
    };

    expect(buildListenSession(plan, pageVerses)).toMatchObject({
      playlist: [
        { surah: 1, ayah: 1 },
        { surah: 1, ayah: 2 },
      ],
      repeatCount: 1,
    });
  });

  it.each<ListenPlan>([
    { scope: "ayah", ...noRepeat },
    { scope: "ayah", surah: 1, ayah: 7, ...noRepeat },
    { scope: "ayah-range", surah: 1, ayah: 1, ...noRepeat },
    { scope: "page", ...noRepeat },
    { scope: "page", page: 604, ...noRepeat },
    { scope: "page-range", page: 1, ...noRepeat },
    { scope: "surah", ...noRepeat },
    { scope: "surah", surah: 114, ...noRepeat },
    { scope: "juz", ...noRepeat },
    { scope: "juz", juz: 30, ...noRepeat },
  ])("returns null for an unbuildable $scope session", (plan) => {
    expect(buildListenSession(plan, verses)).toBeNull();
  });

  it("rejects unsupported session scopes", () => {
    const plan = { scope: "unknown", ...noRepeat } as unknown as ListenPlan;
    expect(buildListenSession(plan, verses)).toBeNull();
  });

  it.each<{
    name: string;
    plan: ListenPlan;
    expected:
      | "invalidAyah"
      | "invalidAyahRange"
      | "reversedAyahRange"
      | "invalidPage"
      | "invalidPageRange"
      | "invalidSurah"
      | "invalidSurahAyah"
      | "invalidJuz"
      | null;
  }>([
    {
      name: "valid ayah",
      plan: { scope: "ayah", surah: 1, ayah: 1, ...noRepeat },
      expected: null,
    },
    {
      name: "missing ayah",
      plan: { scope: "ayah", surah: 1, ...noRepeat },
      expected: "invalidAyah",
    },
    {
      name: "surah outside the Quran",
      plan: { scope: "ayah", surah: 115, ayah: 1, ...noRepeat },
      expected: "invalidAyah",
    },
    {
      name: "valid ayah range",
      plan: {
        scope: "ayah-range",
        surah: 1,
        ayah: 2,
        endSurah: 2,
        endAyah: 1,
        ...noRepeat,
      },
      expected: null,
    },
    {
      name: "incomplete ayah range",
      plan: {
        scope: "ayah-range",
        surah: 1,
        ayah: 1,
        endSurah: 2,
        ...noRepeat,
      },
      expected: "invalidAyahRange",
    },
    {
      name: "reversed ayah range",
      plan: {
        scope: "ayah-range",
        surah: 2,
        ayah: 2,
        endSurah: 1,
        endAyah: 2,
        ...noRepeat,
      },
      expected: "reversedAyahRange",
    },
    {
      name: "valid page",
      plan: { scope: "page", page: 604, ...noRepeat },
      expected: null,
    },
    {
      name: "page below range",
      plan: { scope: "page", page: 0, ...noRepeat },
      expected: "invalidPage",
    },
    {
      name: "page above range",
      plan: { scope: "page", page: 605, ...noRepeat },
      expected: "invalidPage",
    },
    {
      name: "valid page range",
      plan: { scope: "page-range", page: 1, endPage: 604, ...noRepeat },
      expected: null,
    },
    {
      name: "page range below range",
      plan: { scope: "page-range", page: 0, endPage: 2, ...noRepeat },
      expected: "invalidPageRange",
    },
    {
      name: "page range above range",
      plan: { scope: "page-range", page: 1, endPage: 605, ...noRepeat },
      expected: "invalidPageRange",
    },
    {
      name: "valid surah",
      plan: { scope: "surah", surah: 2, ...noRepeat },
      expected: null,
    },
    {
      name: "surah below range",
      plan: { scope: "surah", surah: 0, ...noRepeat },
      expected: "invalidSurah",
    },
    {
      name: "surah above range",
      plan: { scope: "surah", surah: 115, ...noRepeat },
      expected: "invalidSurah",
    },
    {
      name: "invalid surah start ayah",
      plan: { scope: "surah", surah: 2, ayah: 200, ...noRepeat },
      expected: "invalidSurahAyah",
    },
    {
      name: "valid juz",
      plan: { scope: "juz", juz: 30, ...noRepeat },
      expected: null,
    },
    {
      name: "juz below range",
      plan: { scope: "juz", juz: 0, ...noRepeat },
      expected: "invalidJuz",
    },
    {
      name: "juz above range",
      plan: { scope: "juz", juz: 31, ...noRepeat },
      expected: "invalidJuz",
    },
  ])("validates $name", ({ plan, expected }) => {
    expect(validateListenPlan(plan, verses, 604)).toBe(expected);
  });

  it("returns an explicit code for unsupported validation scopes", () => {
    const plan = { scope: "unknown", ...noRepeat } as unknown as ListenPlan;
    expect(validateListenPlan(plan, verses, 604)).toBe("unsupportedScope");
  });

  it.each<{
    name: string;
    preset: ListenPreset | null | undefined;
    expected: Partial<ListenPlan>;
  }>([
    {
      name: "no preset",
      preset: null,
      expected: { scope: "surah", surah: 1, ayah: 1 },
    },
    {
      name: "surah preset",
      preset: { scope: "surah", surah: 2 },
      expected: { scope: "surah", surah: 2, ayah: 1 },
    },
    {
      name: "juz scope without a number",
      preset: { scope: "juz" },
      expected: { scope: "juz", juz: 1 },
    },
    {
      name: "juz number",
      preset: { juz: 4 },
      expected: { scope: "juz", juz: 4 },
    },
    {
      name: "page scope without a number",
      preset: { scope: "page" },
      expected: { scope: "page", page: 1, endPage: 1 },
    },
    {
      name: "page number",
      preset: { page: 7 },
      expected: { scope: "page", page: 7, endPage: 7 },
    },
    {
      name: "specific ayah",
      preset: { surah: 3, ayah: 5 },
      expected: { scope: "ayah", surah: 3, ayah: 5 },
    },
    {
      name: "surah number without scope",
      preset: { surah: 3 },
      expected: { scope: "surah", surah: 3, ayah: 1 },
    },
    {
      name: "empty preset",
      preset: {},
      expected: { scope: "surah", surah: 1, ayah: 1 },
    },
  ])("derives the default plan for $name", ({ preset, expected }) => {
    expect(defaultPlanFromPreset(preset)).toMatchObject({
      ...expected,
      repeatMode: "none",
      repeatCount: 1,
    });
  });
});
