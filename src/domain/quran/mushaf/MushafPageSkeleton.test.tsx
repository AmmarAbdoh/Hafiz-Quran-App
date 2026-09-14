// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MushafPageSkeleton } from "./MushafPageSkeleton";
import type { MushafPageLayout, MushafWord } from "../model";

function word(line: number, index: number): MushafWord {
  return {
    verse_key: "2:1",
    sura: 2,
    aya: 1,
    word: index,
    location: `2:1:${line}${index}`,
    line,
    page: 5,
    code_v2: "ﱁ",
    char_type: "word",
  };
}

const threeLinePage: MushafPageLayout = {
  page: 5,
  lines: [
    { line: 1, words: [word(1, 1)] },
    { line: 2, words: [word(2, 1)] },
    { line: 3, words: [word(3, 1)] },
  ],
};

function lineCount(container: HTMLElement) {
  return container.querySelectorAll(".mushaf-line").length;
}

describe("MushafPageSkeleton", () => {
  it("announces the wait without showing the text", () => {
    render(<MushafPageSkeleton label="Loading page" />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading page");
    expect(status.querySelector(".sr-only")).toHaveTextContent("Loading page");
  });

  it("draws the full page grid when no layout is known", () => {
    const { container } = render(
      <MushafPageSkeleton label="Loading" page={5} />,
    );

    expect(lineCount(container)).toBe(15);
    expect(container.querySelector(".mushaf-page--full")).toBeInTheDocument();
  });

  it("mirrors the line count of a known layout so the text lands in place", () => {
    const { container } = render(
      <MushafPageSkeleton label="Loading" pageLayout={threeLinePage} />,
    );

    expect(lineCount(container)).toBe(3);
  });

  it("uses the centred geometry and heading of the opening pages", () => {
    const { container } = render(
      <MushafPageSkeleton label="Loading" page={1} />,
    );

    expect(container.querySelector(".mushaf-page--full")).toBeNull();
    expect(
      container.querySelector(".mushaf-surah-header-block"),
    ).toBeInTheDocument();
    expect(lineCount(container)).toBe(7);
  });

  it("honours an explicit line count for partial page previews", () => {
    const { container } = render(
      <MushafPageSkeleton label="Loading" page={5} lines={4} />,
    );

    expect(lineCount(container)).toBe(4);
  });
});
