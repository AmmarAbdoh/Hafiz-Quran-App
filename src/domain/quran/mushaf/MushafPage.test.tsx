// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MushafPageLayout, MushafWord } from "../model";
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

const layout: MushafPageLayout = {
  page: 1,
  lines: [
    {
      line: 2,
      words: [interactiveWord],
    },
  ],
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

  it("uses a native button when word interaction is enabled", () => {
    const onWordActivate = vi.fn();
    render(
      <MushafPage
        pageLayout={layout}
        fontFamily="Test Mushaf"
        selectedWordLocation="1:1:1"
        getWordActivationLabel={(word) => `Open ${word.location}`}
        onWordActivate={onWordActivate}
      />,
    );

    const button = screen.getByRole("button", { name: "Open 1:1:1" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("aria-pressed", "true");
    button.focus();
    expect(button).toHaveFocus();

    fireEvent.click(button);
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
