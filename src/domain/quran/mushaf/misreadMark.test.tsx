// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MushafWordGlyph } from "@/domain/quran/mushaf/MushafWordGlyph";

const word = {
  id: 1,
  position: 1,
  location: "1:1:1",
  char_type: "word",
  text: "بِسْمِ",
  verse_key: "1:1",
} as never;

describe("a word the reciter misread", () => {
  it("is marked so it can be seen after the moment has passed", () => {
    const { container } = render(
      <MushafWordGlyph word={word} fontFamily="x" fontReady misread />,
    );
    expect(
      container.querySelector(".mushaf-word--practice-misread"),
    ).not.toBeNull();
  });

  it("defers to the shake while the mistake is still happening", () => {
    const { container } = render(
      <MushafWordGlyph
        word={word}
        fontFamily="x"
        fontReady
        misread
        incorrect
      />,
    );
    expect(
      container.querySelector(".mushaf-word--practice-wrong"),
    ).not.toBeNull();
    expect(
      container.querySelector(".mushaf-word--practice-misread"),
    ).toBeNull();
  });
});
