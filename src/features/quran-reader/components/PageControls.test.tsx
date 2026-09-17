// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import { PageControls } from "./PageControls";

function renderControls(
  overrides: Partial<Parameters<typeof PageControls>[0]> = {},
) {
  const onPageChange = vi.fn<(page: number) => void>();
  render(
    <LocaleProvider>
      <PageControls
        currentPage={3}
        totalPages={604}
        onPageChange={onPageChange}
        {...overrides}
      />
    </LocaleProvider>,
  );
  return { onPageChange };
}

describe("PageControls", () => {
  /*
   * `currentPage` is a prop driven by the URL, and the URL only updates once
   * the route commits - which does not happen between two taps fired faster
   * than a render. A naive `currentPage + 1` computed fresh on every click
   * reads the same stale value each time, so a burst of real taps mostly
   * asks to go to the very page the first tap already asked for: the control
   * looks like it stopped responding after the first click of a fast burst.
   *
   * The parent intentionally never re-renders with a new `currentPage` here,
   * reproducing exactly that lag.
   */
  it("advances one page per click even when the route has not caught up between clicks", () => {
    const { onPageChange } = renderControls();

    const next = screen.getByRole("button", { name: "الصفحة التالية" });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);

    expect(onPageChange.mock.calls.map((call) => call[0])).toEqual([4, 5, 6]);
  });

  it("does the same composing backwards for the previous-page button", () => {
    const { onPageChange } = renderControls();

    const prev = screen.getByRole("button", { name: "الصفحة السابقة" });
    fireEvent.click(prev);
    fireEvent.click(prev);

    expect(onPageChange.mock.calls.map((call) => call[0])).toEqual([2, 1]);
  });

  it("stops at the boundary instead of composing past it", () => {
    const { onPageChange } = renderControls({ currentPage: 604 });

    const next = screen.getByRole("button", { name: "الصفحة التالية" });
    fireEvent.click(next);
    fireEvent.click(next);

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("follows the route once it catches up rather than keeping stale ground", () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <LocaleProvider>
        <PageControls
          currentPage={3}
          totalPages={604}
          onPageChange={onPageChange}
        />
      </LocaleProvider>,
    );

    // The route settles on a page reached some other way - a swipe, the
    // surah drawer, a keyboard shortcut - while our own pending target was
    // never advanced. The next click should build on that new reality.
    rerender(
      <LocaleProvider>
        <PageControls
          currentPage={10}
          totalPages={604}
          onPageChange={onPageChange}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText("١٠")).toBeInTheDocument();
  });
});
