// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import { MushafReaderBar } from "./MushafReaderBar";

function renderBar(
  overrides: Partial<Parameters<typeof MushafReaderBar>[0]> = {},
) {
  render(
    <LocaleProvider>
      <MushafReaderBar
        page={3}
        juzNumber={1}
        hizbNumber={2}
        pageControls={<button type="button">page controls</button>}
        showControls
        {...overrides}
      />
    </LocaleProvider>,
  );
}

describe("MushafReaderBar", () => {
  it("names the juz and hizb", () => {
    renderBar();

    expect(screen.getByText("الجزء ١")).toBeInTheDocument();
    expect(screen.getByText("الحزب ٢")).toBeInTheDocument();
  });

  it("shows page navigation by default rather than waiting for a tap", () => {
    renderBar();

    expect(
      screen.getByRole("button", { name: "page controls" }),
    ).toBeInTheDocument();
  });

  /**
   * INVARIANT #14: the reader states where it is without being asked. Asking
   * for a bare page takes away the navigation, never the position.
   */
  it("still states the position once navigation is put away", () => {
    renderBar({ showControls: false });

    expect(
      screen.queryByRole("button", { name: "page controls" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("الجزء ١")).toBeInTheDocument();
    expect(screen.getByLabelText("صفحة ٣")).toHaveTextContent("٣");
  });

  it("keeps stating the page when the juz and hizb are unknown", () => {
    renderBar({ juzNumber: null, hizbNumber: null, showControls: false });

    expect(screen.queryByText(/الجزء/)).not.toBeInTheDocument();
    expect(screen.queryByText(/الحزب/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("صفحة ٣")).toHaveTextContent("٣");
  });
});
