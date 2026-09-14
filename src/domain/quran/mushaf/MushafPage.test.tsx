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

  it("exposes plain ayah text on verse groups and keeps glyph buttons out of tab order", () => {
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

    expect(screen.getByRole("group", { name: verseText })).toBeInTheDocument();

    const glyphButton = document.querySelector(
      "[data-location='1:1:1']",
    ) as HTMLButtonElement;
    expect(glyphButton.tagName).toBe("BUTTON");
    expect(glyphButton).toHaveAttribute("tabindex", "-1");
    expect(glyphButton).toHaveAttribute("aria-hidden", "true");
    expect(glyphButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(glyphButton);
    expect(onWordActivate).toHaveBeenCalledWith(
      interactiveWord,
      expect.objectContaining({ type: "click" }),
    );
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
