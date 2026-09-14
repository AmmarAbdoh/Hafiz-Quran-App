// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import { MushafPageProgress } from "./MushafPageProgress";

function renderProgress(
  overrides: Partial<Parameters<typeof MushafPageProgress>[0]> = {},
) {
  render(
    <LocaleProvider>
      <MushafPageProgress
        page={3}
        juzNumber={1}
        hizbNumber={2}
        {...overrides}
      />
    </LocaleProvider>,
  );
}

describe("MushafPageProgress", () => {
  it("names the juz and hizb beside the page number", () => {
    renderProgress();

    expect(screen.getByText("الجزء ١")).toBeInTheDocument();
    expect(screen.getByText("الحزب ٢")).toBeInTheDocument();
    expect(screen.getByText("٣")).toBeInTheDocument();
  });

  it("labels the bare page number for screen readers", () => {
    renderProgress();

    expect(screen.getByLabelText("صفحة ٣")).toHaveTextContent("٣");
  });

  it("keeps the page number when the juz and hizb are unknown", () => {
    renderProgress({ juzNumber: null, hizbNumber: null });

    expect(screen.queryByText(/الجزء/)).not.toBeInTheDocument();
    expect(screen.queryByText(/الحزب/)).not.toBeInTheDocument();
    expect(screen.getByText("٣")).toBeInTheDocument();
  });
});
