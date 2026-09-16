import { describe, expect, it } from "vitest";
import { stripAyahMarker } from "./ayahMarker";

/*
 * Real values from the corpus: the marker is U+FC00 for ayah 1 and runs to
 * U+FD1D for ayah 286, the longest surah. In an interface font U+FC00 is
 * ARABIC LIGATURE BEH WITH JEEM, so an unstripped ayah 1 reads "جب".
 */
const AYAH_1 = "\uFC00";
const AYAH_3 = "\uFC02";
const AYAH_286 = "\uFD1D";

describe("ayah markers", () => {
  it.each([AYAH_1, AYAH_3, AYAH_286])("removes %s", (marker) => {
    expect(stripAyahMarker(`نص${"\u00A0"}${marker}`)).toBe("نص");
  });

  it("drops the marker and the space holding it", () => {
    expect(stripAyahMarker(`ٱلْحَمْدُ${"\u00A0"}${AYAH_1}`)).toBe("ٱلْحَمْدُ");
  });

  it("handles the longest surah's last ayah", () => {
    expect(stripAyahMarker(`نص ${AYAH_286}`)).toBe("نص");
  });

  it("leaves text that has no marker alone", () => {
    expect(stripAyahMarker("بسم الله الرحمن الرحيم")).toBe(
      "بسم الله الرحمن الرحيم",
    );
  });

  /*
   * The same codepoints are genuine Arabic ligatures elsewhere. Only a
   * trailing one is the ayah number, so only a trailing one is removed.
   */
  it("leaves a ligature inside a word alone", () => {
    expect(stripAyahMarker(`ا${AYAH_1}ب`)).toBe(`ا${AYAH_1}ب`);
  });

  it("removes only the one marker, not a run of them", () => {
    expect(stripAyahMarker(`نص ${AYAH_1}${AYAH_3}`)).toBe(`نص ${AYAH_1}`);
  });
});
