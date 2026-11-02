import { describe, expect, it } from "vitest";
import { pauseStopsOf } from "./pauseStops";

/*
 * The real symbol table ships with the model and is not in the repository,
 * so each test lists the symbols its words use.
 */
const symbolsOf = (...units: string[][]) => [...new Set(units.flat())];

describe("where a reciter may stop, and what stopping sounds like", () => {
  /* The case that was found: 3:7, stopped at مُتَشَٰبِهَٰتٌ ۖ. */
  const UKHAR = ["وَ", "ءُ", "خَ", "رُ"];
  const JOINED = [
    ..."مُ تَ شَ اا بِ هَ اا تُ ںںں".split(" "),
    ..."فَ ءَ ممممَ".split(" "),
  ];
  const ALLADHINA = ["للَ", "ذِ", "ۦۦ", "نَ"];

  it("finds the tanween joining makes, and where the next word begins", () => {
    const stops = pauseStopsOf(
      ["وَأُخَرُ", "مُتَشَـٰبِهَـٰتٌۭ", "فَأَمَّا", "ٱلَّذِينَ"],
      ["وَأُخَرُ", "مُتَشَـٰبِهَـٰتٌۭ ۖ", "فَأَمَّا", "ٱلَّذِينَ"],
      ["وَءُخَرُ", "مُتَشَاابِهَااتُںںںفَءَممممَ", "للَذِۦۦنَ"],
      symbolsOf(UKHAR, JOINED, ALLADHINA),
    );

    /* تُ and its nasal only joining makes; فَ is where فَأَمَّا starts. */
    expect(stops).toEqual([
      [],
      [
        {
          from: 7,
          at: 9,
          letters: ["ت"],
          alif: false,
          opening: null,
          hamza: false,
        },
      ],
      [],
    ]);
  });

  it("makes nothing where there is no mark", () => {
    const stops = pauseStopsOf(
      ["وَأُخَرُ", "مُتَشَـٰبِهَـٰتٌۭ", "فَأَمَّا", "ٱلَّذِينَ"],
      ["وَأُخَرُ", "مُتَشَـٰبِهَـٰتٌۭ", "فَأَمَّا", "ٱلَّذِينَ"],
      ["وَءُخَرُ", "مُتَشَاابِهَااتُںںںفَءَممممَ", "للَذِۦۦنَ"],
      symbolsOf(UKHAR, JOINED, ALLADHINA),
    );

    expect(stops.flat()).toEqual([]);
  });

  /* حَنِيفٗاۚ وَمَا: stopping lengthens the fathatan into an alif, and the
     merged و is said once when وَمَا is started afresh. */
  it("lengthens a fathatan and says the merged word's opening once", () => {
    const units = ["حَ", "نِ", "ۦۦ", "فَ", "وووَ", "مَ", "اا"];
    const [stops] = pauseStopsOf(
      ["حَنِيفًۭا", "وَمَا"],
      ["حَنِيفٗاۚ", "وَمَا"],
      ["حَنِۦۦفَوووَمَاا"],
      symbolsOf(units),
    );

    expect(stops).toEqual([
      { from: 4, at: 4, letters: [], alif: true, opening: "وَ", hamza: false },
    ]);
  });

  it("stops a ta marbuta as ه", () => {
    const units = ["غِ", "شَ", "اا", "وَ", "تُ", "وووَ", "لَ", "هُ", "م"];
    const [stops] = pauseStopsOf(
      ["غِشَـٰوَةٌۭ", "وَلَهُمْ"],
      ["غِشَٰوَةٞۖ", "وَلَهُمۡ"],
      ["غِشَااوَتُوووَلَهُم"],
      symbolsOf(units),
    );

    expect(stops?.[0]).toMatchObject({
      from: 4,
      at: 5,
      letters: ["ت", "ه"],
      opening: "وَ",
    });
  });

  /* بِهِۦ stopped is بِهْ: joining is all that lengthens the pronoun. */
  it("drops the pronoun's lengthening at the end of a word", () => {
    const units = ["بِ", "هِ", "ۦۦ"];
    const [stops] = pauseStopsOf(
      ["بِهِۦ"],
      ["بِهِۦۖ"],
      ["بِهِۦۦ"],
      symbolsOf(units),
    );

    expect(stops).toEqual([
      {
        from: 1,
        at: 3,
        letters: ["ه"],
        alif: false,
        opening: null,
        hamza: false,
      },
    ]);
  });
});
