import { describe, expect, it } from "vitest";
import {
  findAyahByOpening,
  withFirstSoundMissing,
  type AyahOpening,
} from "./ayahOpenings";

const units = (text: string) => text.split(" ");
/* As heard: each sound the recogniser's choice, with no runner-ups. */
const sounds = (text: string) => units(text).map((unit) => [unit]);
const near = () => 0;

/* Ten sounds each, as letters standing in for phonemes. */
const OPENINGS: AyahOpening[] = [
  { verseKey: "2:21", units: units("y a a y u h a n n a s"), next: "2:22" },
  { verseKey: "2:104", units: units("y a a y u h a l l a d"), next: "2:105" },
  { verseKey: "3:2", units: units("a l l a h u l a i l"), next: "3:3" },
  {
    verseKey: "2:255",
    units: units("a l l a h u l a i l a h a i l l a"),
    next: "2:256",
  },
  { verseKey: "3:3", units: units("n a z z a l a a l a y"), next: "3:4" },
];

describe("finding the ayah a reciter starts", () => {
  it("names the ayah once only one opening fits", () => {
    expect(
      findAyahByOpening(sounds("y a a y u h a n n a"), OPENINGS, near),
    ).toEqual({ verseKey: "2:21" });
  });

  it("waits while several openings still fit", () => {
    expect(findAyahByOpening(sounds("y a a y u h a"), OPENINGS, near)).toBe(
      null,
    );
    expect(
      findAyahByOpening(sounds("y a a y u h a n"), OPENINGS, near),
    ).toEqual({ verseKey: "2:21" });
    expect(
      findAyahByOpening(sounds("a l l a h u l a i l"), OPENINGS, near),
    ).toBe("wait");
  });

  it("lets something else come first, like an isti'adha", () => {
    expect(
      findAyahByOpening(sounds("q w z y a a y u h a n n a"), OPENINGS, near),
    ).toEqual({ verseKey: "2:21" });
  });

  it("finds nothing in sounds that open no ayah", () => {
    expect(
      findAyahByOpening(sounds("q w z q w z q w z q"), OPENINGS, near),
    ).toBeNull();
  });

  /* 3:2 is the first words of 2:255 and nothing else. */
  it("takes a short ayah said whole only when its own next ayah follows", () => {
    expect(
      findAyahByOpening(
        sounds("a l l a h u l a i l n a z z a"),
        OPENINGS,
        near,
      ),
    ).toEqual({ verseKey: "3:2" });
    expect(
      findAyahByOpening(sounds("a l l a h u l a i l a h a"), OPENINGS, near),
    ).toEqual({ verseKey: "2:255" });
  });

  it("takes the nearest of ayat that cannot be told apart by sound", () => {
    const refrain = units("f a b i a y y i a a");
    const twins: AyahOpening[] = [
      { verseKey: "55:13", units: refrain },
      { verseKey: "55:16", units: refrain },
    ];
    expect(
      findAyahByOpening(
        refrain.map((unit) => [unit]),
        twins,
        (key) => (key === "55:16" ? 1 : 5),
      ),
    ).toEqual({ verseKey: "55:16" });
  });

  it("hears a sound the recogniser gave as a close runner-up", () => {
    const heard = sounds("y a a y u h a n n a");
    heard[7] = ["t", "n"];
    expect(findAyahByOpening(heard, OPENINGS, near)).toEqual({
      verseKey: "2:21",
    });
  });

  /* The first sound of a recitation is the one most often not heard. */
  it("finds an ayah whose first sound the recogniser missed", () => {
    expect(
      findAyahByOpening(
        sounds("a a y u h a n n a s"),
        withFirstSoundMissing(OPENINGS),
        near,
      ),
    ).toEqual({ verseKey: "2:21" });
  });
});
