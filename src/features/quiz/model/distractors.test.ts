import { buildNumericDistractors, buildSurahDistractors } from "./distractors";

describe("buildNumericDistractors", () => {
  it("stays inside the real domain so short surahs cannot be answered by elimination", () => {
    const values = buildNumericDistractors({ correct: 2, min: 1, max: 4 });

    expect(values).not.toContain(2);
    expect(values.every((value) => value >= 1 && value <= 4)).toBe(true);
    expect([...values].sort()).toEqual([1, 3, 4]);
  });

  it("prefers values that occur in the scope", () => {
    const values = buildNumericDistractors({
      correct: 300,
      min: 1,
      max: 604,
      preferred: [301, 302, 303],
      limit: 3,
    });

    expect([...values].sort()).toEqual([301, 302, 303]);
  });

  it("spreads outward from the correct value when the scope offers too few", () => {
    const values = buildNumericDistractors({
      correct: 10,
      min: 1,
      max: 30,
      limit: 4,
    });

    expect(values).toHaveLength(4);
    expect(values.every((value) => Math.abs(value - 10) <= 2)).toBe(true);
  });

  it("clamps at the domain edges", () => {
    const values = buildNumericDistractors({
      correct: 1,
      min: 1,
      max: 3,
      limit: 4,
    });

    expect([...values].sort()).toEqual([2, 3]);
  });
});

describe("buildSurahDistractors", () => {
  it("offers scope surahs before mushaf neighbours", () => {
    const values = buildSurahDistractors(112, [113, 114], 2);

    expect([...values].sort()).toEqual([113, 114]);
  });

  it("falls back to neighbouring surahs and never repeats the answer", () => {
    const values = buildSurahDistractors(2, [], 3);

    expect(values).not.toContain(2);
    expect(new Set(values).size).toBe(values.length);
    expect(values.every((surah) => surah >= 1 && surah <= 114)).toBe(true);
  });
});
