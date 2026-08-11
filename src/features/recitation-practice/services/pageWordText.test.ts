import type { MushafWord } from "@/domain/quran";
import { buildPageExpectedWords } from "./pageWordText";

function makeWord(
  verseKey: string,
  position: number,
  charType = "word",
): MushafWord {
  const [surah, ayah] = verseKey.split(":").map(Number);
  return {
    verse_key: verseKey,
    sura: surah!,
    aya: ayah!,
    word: position,
    location: `${verseKey}:${position}`,
    line: 1,
    page: 1,
    code_v2: "glyph",
    char_type: charType,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildPageExpectedWords", () => {
  it("loads each verse once, excludes end marks, and chooses readable text", async () => {
    const fetchMock = vi.fn((url: string) => {
      const verseKey = decodeURIComponent(
        url.match(/by_key\/([^?]+)/)?.[1] ?? "",
      );
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            verse: {
              words:
                verseKey === "90:1"
                  ? [
                      {
                        position: 1,
                        text_uthmani: "ٱلْبَلَدِ",
                        text_imlaei: " البلد ",
                        text_imlaei_simple: " البلد ",
                        char_type_name: "word",
                      },
                      {
                        position: 2,
                        text_uthmani: "هَٰذَا",
                        text_imlaei: " هذا ",
                        char_type_name: "word",
                      },
                      {
                        position: 3,
                        text_uthmani: "۝",
                        char_type_name: "end",
                      },
                    ]
                  : [
                      {
                        position: 1,
                        text_uthmani: "وَأَنتَ",
                        char_type_name: "word",
                      },
                    ],
            },
          }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await buildPageExpectedWords([
      makeWord("90:1", 1),
      makeWord("90:1", 2),
      makeWord("90:1", 3, "end"),
      makeWord("90:2", 1),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject([
      {
        location: "90:1:1",
        verseKey: "90:1",
        text: "ٱلْبَلَدِ",
        displayText: "البلد",
      },
      {
        location: "90:1:2",
        verseKey: "90:1",
        text: "هَٰذَا",
        displayText: "هذا",
      },
      {
        location: "90:2:1",
        verseKey: "90:2",
        text: "وَأَنتَ",
        displayText: "وَأَنتَ",
      },
    ]);
    expect(result.every((word) => word.normalized.length > 0)).toBe(true);
  });

  it("falls back to a stable location token when API word data is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ verse: {} }),
      }),
    );

    await expect(
      buildPageExpectedWords([makeWord("91:1", 2)]),
    ).resolves.toEqual([
      expect.objectContaining({
        text: "word-91:1:2",
        displayText: "word-91:1:2",
      }),
    ]);
  });

  it("caches a resolved verse response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ verse: { words: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const words = [makeWord("92:1", 1)];

    await buildPageExpectedWords(words);
    await buildPageExpectedWords(words);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects an unsuccessful Quran.com response without caching it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ verse: { words: [] } }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const words = [makeWord("93:1", 1)];

    await expect(buildPageExpectedWords(words)).rejects.toThrow(
      "Failed to load words for 93:1",
    );
    await expect(buildPageExpectedWords(words)).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not request data for a page containing only end marks", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      buildPageExpectedWords([makeWord("94:1", 1, "end")]),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
