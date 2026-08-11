import { afterEach, describe, expect, it, vi } from "vitest";
import type { MushafVerse } from "@/domain/quran";
import { generateAudioIdentifyQuestion } from "./audioIdentify";

function makeVerse(
  id: number,
  suraNo: number,
  ayahNo: number,
  text = `verse ${id}`,
): MushafVerse {
  return {
    id,
    jozz: 1,
    page: 1,
    sura_no: suraNo,
    sura_name_en: `Surah ${suraNo}`,
    sura_name_ar: `Surah ${suraNo} Arabic`,
    line_start: 1,
    line_end: 1,
    aya_no: ayahNo,
    aya_text: text,
    aya_text_emlaey: text,
  };
}

const first = makeVerse(1, 1, 1);
const second = makeVerse(
  2,
  1,
  2,
  "one two three four five six seven eight nine ten",
);
const distractors = Array.from({ length: 14 }, (_, index) =>
  makeVerse(index + 10, index + 2, 1),
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateAudioIdentifyQuestion", () => {
  it("uses a surah prompt when random selection chooses it", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const question = generateAudioIdentifyQuestion(
      first,
      [first, second, ...distractors],
      [first, second, ...distractors],
    );

    expect(question.audioPrompt).toBe("surah");
    expect(question.correctChoiceId).toBe("1");
    expect(question.choices).toHaveLength(4);
    expect(question.choices.some(({ id }) => id === "1")).toBe(true);
  });

  it("uses a surah prompt when the selected ayah has no successor", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);

    const question = generateAudioIdentifyQuestion(
      second,
      [first, second, ...distractors],
      [first, second, ...distractors],
    );

    expect(question.audioPrompt).toBe("surah");
    expect(question.correctChoiceId).toBe("1");
  });

  it("asks for the following ayah and excludes current and correct verses from distractors", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const pool = [first, second, ...distractors];

    const question = generateAudioIdentifyQuestion(first, pool, pool);

    expect(question.audioPrompt).toBe("next_ayah");
    expect(question.correctChoiceId).toBe("1:2");
    expect(question.choices).toHaveLength(4);
    expect(question.choices).not.toContainEqual(
      expect.objectContaining({ id: "1:1" }),
    );
    expect(question.choices.find(({ id }) => id === "1:2")?.label).toContain(
      "…",
    );
  });

  it("falls back to the verse label when a surah is outside the name table", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const unknown = makeVerse(200, 115, 1);

    const question = generateAudioIdentifyQuestion(
      unknown,
      [unknown],
      [unknown],
    );
    expect(question.choices).toContainEqual({
      id: "115",
      label: "Surah 115 Arabic",
    });
  });
});
