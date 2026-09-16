// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MushafPageLayout, MushafVerse, MushafWord } from "../model";
import { buildVerseTextIndex } from "../model";
import { MushafPage } from "./MushafPage";

const interactiveWord: MushafWord = {
  verse_key: "1:1",
  sura: 1,
  aya: 1,
  word: 1,
  location: "1:1:1",
  line: 2,
  page: 1,
  code_v2: "ﱁ",
  char_type: "word",
};

const verseText = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

const mushafVerse: MushafVerse = {
  id: 1,
  sura_no: 1,
  aya_no: 1,
  aya_text: verseText,
  aya_text_emlaey: "بسم الله الرحمن الرحيم",
  page: 1,
  jozz: 1,
  line_start: 1,
  line_end: 1,
  sura_name_ar: "الفَاتِحَة",
  sura_name_en: "Al-Fatihah",
};

const layout: MushafPageLayout = {
  page: 1,
  lines: [
    {
      line: 2,
      words: [interactiveWord],
    },
  ],
};

const verseTextByKey = buildVerseTextIndex([mushafVerse]);

/*
 * Pages 1 and 2 are centre-aligned; every other page is a "spread" that
 * justifies its words across the full measure, which moves the keyboard
 * affordance off the ayah run and onto its first word group.
 */
const spreadWord: MushafWord = {
  ...interactiveWord,
  verse_key: "2:6",
  sura: 2,
  aya: 6,
  location: "2:6:1",
  page: 3,
};

const spreadVerseText = "إِنَّ ٱلَّذِينَ كَفَرُوا۟";

const spreadVerseTextByKey = buildVerseTextIndex([
  {
    ...mushafVerse,
    id: 13,
    sura_no: 2,
    aya_no: 6,
    aya_text: spreadVerseText,
    page: 3,
  },
]);

const spreadLayoutPage: MushafPageLayout = {
  page: 3,
  lines: [{ line: 2, words: [spreadWord] }],
};

describe("MushafPage", () => {
  it("renders passive Arabic content without requiring callbacks", () => {
    const { container } = render(
      <MushafPage
        pageLayout={layout}
        surahNames={new Map([[1, "الفَاتِحَة"]])}
        fontFamily="Test Mushaf"
      />,
    );

    const page = container.querySelector(".mushaf-page");
    expect(page).toHaveAttribute("dir", "rtl");
    expect(page).toHaveAttribute("lang", "ar");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByLabelText("سورة الفَاتِحَة")).toBeInTheDocument();
  });

  it("exposes plain ayah text on the verse and keeps glyph buttons out of tab order", () => {
    const onWordActivate = vi.fn();
    render(
      <MushafPage
        pageLayout={layout}
        fontFamily="Test Mushaf"
        selectedWordLocation="1:1:1"
        verseTextByKey={verseTextByKey}
        onWordActivate={onWordActivate}
      />,
    );

    // The ayah is the page's one keyboard target; per-glyph announcements
    // would be unusable, so the glyphs stay hidden from assistive tech.
    const ayah = screen.getByRole("button", { name: verseText });
    expect(ayah).toHaveAttribute("tabindex", "0");

    const glyph = document.querySelector(
      "[data-location='1:1:1']",
    ) as HTMLElement;
    // Not a button: nesting one inside the ayah's own control is a serious
    // accessibility fault, and the glyph was never exposed to assistive
    // technology anyway - it only ever had to catch pointer events.
    expect(glyph.tagName).toBe("SPAN");
    expect(glyph).toHaveAttribute("aria-hidden", "true");
    expect(glyph).toHaveAttribute("data-selected", "true");

    fireEvent.click(glyph);
    expect(onWordActivate).toHaveBeenCalledWith(
      interactiveWord,
      expect.objectContaining({ type: "click" }),
    );
  });

  /**
   * The verse actions - listen, tafsir, copy, share, bookmark - could only be
   * reached with a pointer: the ayah was focusable but answered no key, so a
   * keyboard or screen reader had no way to them at all (INVARIANT #4).
   */
  it.each(["Enter", " "])("activates the ayah on %s", (key) => {
    const onWordActivate = vi.fn();
    render(
      <MushafPage
        pageLayout={layout}
        fontFamily="Test Mushaf"
        verseTextByKey={verseTextByKey}
        onWordActivate={onWordActivate}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: verseText }), { key });

    expect(onWordActivate).toHaveBeenCalledTimes(1);
    const [word, event] = onWordActivate.mock.calls[0] as [
      { verse_key: string },
      { type: string },
    ];
    expect(word.verse_key).toBe(interactiveWord.verse_key);
    // No coordinates: what tells the reader to open the whole ayah rather
    // than resolve a single glyph under a finger.
    expect(event).not.toHaveProperty("clientX");
    expect(event.type).toBe("keydown");
  });

  it("leaves other keys to the page", () => {
    const onWordActivate = vi.fn();
    render(
      <MushafPage
        pageLayout={layout}
        fontFamily="Test Mushaf"
        verseTextByKey={verseTextByKey}
        onWordActivate={onWordActivate}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: verseText }), {
      key: "ArrowLeft",
    });

    expect(onWordActivate).not.toHaveBeenCalled();
  });

  /*
   * The run is `display: contents` on a spread page - it has to be, for the
   * word groups to justify across the measure - so it has no box and cannot be
   * focused. The affordance moves to the first word group, and the run must
   * stop repeating the ayah text or every ayah is announced twice.
   */
  it("moves the keyboard target onto the first word group on a spread page", () => {
    const onWordActivate = vi.fn();
    render(
      <MushafPage
        pageLayout={spreadLayoutPage}
        fontFamily="Test Mushaf"
        verseTextByKey={spreadVerseTextByKey}
        onWordActivate={onWordActivate}
      />,
    );

    const target = screen.getByRole("button", { name: spreadVerseText });
    expect(target).toHaveClass("mushaf-word-group--ayah");
    expect(target).toHaveAttribute("tabindex", "0");

    expect(
      screen.queryByRole("group", { name: spreadVerseText }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(target, { key: "Enter" });
    expect(onWordActivate).toHaveBeenCalledTimes(1);
  });

  /*
   * The quiz asks "which surah is this ayah from" over a page filtered to that
   * surah - and the filtered page keeps the surah's opening, so the answer was
   * printed above the question.
   */
  it("can omit the surah name band", () => {
    const { rerender } = render(
      <MushafPage
        pageLayout={layout}
        surahNames={new Map([[1, "الفَاتِحَة"]])}
        fontFamily="Test Mushaf"
      />,
    );
    expect(screen.getByLabelText("سورة الفَاتِحَة")).toBeInTheDocument();

    rerender(
      <MushafPage
        pageLayout={layout}
        surahNames={new Map([[1, "الفَاتِحَة"]])}
        fontFamily="Test Mushaf"
        hideSurahHeader
      />,
    );
    expect(screen.queryByLabelText("سورة الفَاتِحَة")).not.toBeInTheDocument();
    // The ayah itself still renders - the question needs something to show.
    expect(document.querySelector("[data-location='1:1:1']")).not.toBeNull();
  });

  it("renders glyph data as text instead of HTML", () => {
    const unsafeGlyph = {
      ...interactiveWord,
      code_v2: "<script>bad()</script>",
    };
    const { container } = render(
      <MushafPage
        pageLayout={{
          page: 1,
          lines: [{ line: 2, words: [unsafeGlyph] }],
        }}
        fontFamily="Test Mushaf"
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(
      container.querySelector("[data-location='1:1:1']"),
    ).toHaveTextContent("<script>bad()</script>");
  });
});
