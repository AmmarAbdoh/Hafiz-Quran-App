// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "@/app/i18n";
import { DEMO_AYAH_LABEL } from "@/domain/quran";
import { STORAGE_KEYS } from "@/shared/storage";
import { HomePage } from "./HomePage";

function renderHomePage() {
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <HomePage />
      </LocaleProvider>
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps Quran text Arabic and RTL independently of interface layout", () => {
    renderHomePage();

    const snippet = screen.getByText(DEMO_AYAH_LABEL);
    expect(snippet).toHaveAttribute("lang", "ar");
    expect(snippet).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("link", { name: /ابدأ القراءة/ })).toHaveAttribute(
      "href",
      "/quran/page/1",
    );
  });

  it("offers to resume from a stored reading position", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.readerPosition,
      JSON.stringify({
        schemaVersion: 1,
        layout: "surah",
        page: 3,
        surah: 2,
        ayah: 25,
        updatedAt: Date.now(),
      }),
    );

    renderHomePage();

    expect(screen.getByRole("link", { name: /افتح المصحف/ })).toHaveAttribute(
      "href",
      "/quran/surah/2/ayah/25",
    );
  });
});
