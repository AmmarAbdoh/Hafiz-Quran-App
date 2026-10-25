// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useReaderKeyboardNavigation } from "./useReaderKeyboardNavigation";

function renderNavigation() {
  const changePage = vi.fn();
  renderHook(() =>
    useReaderKeyboardNavigation({
      enabled: true,
      layoutMode: "page",
      currentPage: 581,
      surahPages: [],
      visibleSurahPage: 581,
      changePage,
      changeSurahPage: vi.fn(),
    }),
  );
  return changePage;
}

describe("turning pages from the keyboard", () => {
  it("turns forward on the left arrow, as an Arabic mushaf reads", () => {
    const changePage = renderNavigation();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true }),
    );

    expect(changePage).toHaveBeenCalledWith(582);
  });

  /*
   * The audio bar's seek line moves through a recitation with the same
   * arrows. Turning the page as well sent the reader to the page after the
   * ayah they had just chosen.
   */
  it("leaves alone an arrow something else has already handled", () => {
    const changePage = renderNavigation();
    const handled = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      cancelable: true,
    });
    handled.preventDefault();

    window.dispatchEvent(handled);

    expect(changePage).not.toHaveBeenCalled();
  });
});
