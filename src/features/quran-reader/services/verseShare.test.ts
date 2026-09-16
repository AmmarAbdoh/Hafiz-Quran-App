import { afterEach, describe, expect, it, vi } from "vitest";
import { stripAyahMarker } from "@/domain/quran";
import { copyVerseText, shareVerseText } from "./verseShare";

/*
 * The one path where Quran text leaves the app. Everything else renders in a
 * font we control; a copied ayah lands in a message, a note, a search box -
 * anywhere. So the payload has to be clean text, not mushaf glyph codes.
 *
 * It was not. Ayah 1 of Al-Fatihah was copied as its words plus U+00A0 and
 * U+FC00, which Unicode calls ARABIC LIGATURE BEH WITH JEEM - so it arrived
 * in other people's conversations with "جب" on the end.
 */
const AYAH_WITH_MARKER = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\u00A0\uFC00";
const AYAH_CLEAN = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

afterEach(() => {
  vi.unstubAllGlobals();
});

function captureClipboard() {
  const writeText = vi.fn<(text: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  return writeText;
}

describe("sharing an ayah", () => {
  it("copies the words without the ayah-number ornament", async () => {
    const writeText = captureClipboard();

    await copyVerseText(stripAyahMarker(AYAH_WITH_MARKER));

    expect(writeText).toHaveBeenCalledWith(AYAH_CLEAN);
  });

  it("puts nothing from the mushaf glyph range on the clipboard", async () => {
    const writeText = captureClipboard();

    await copyVerseText(stripAyahMarker(AYAH_WITH_MARKER));

    const payload = writeText.mock.calls[0]?.[0] ?? "";
    expect(/[\uFC00-\uFD1D]/.test(payload)).toBe(false);
    expect(payload.includes("\u00A0")).toBe(false);
  });

  it("shares the ayah under a title that says where it is from", async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share });

    await shareVerseText(
      stripAyahMarker(AYAH_WITH_MARKER),
      "سورة الفاتحة، الآية ١",
    );

    expect(share).toHaveBeenCalledWith({
      title: "سورة الفاتحة، الآية ١",
      text: AYAH_CLEAN,
    });
  });

  it("falls back to the clipboard where sharing is unavailable", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await shareVerseText(AYAH_CLEAN, "عنوان");

    expect(result).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(AYAH_CLEAN);
  });
});
