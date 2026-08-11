// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "@/app/i18n";
import { DEMO_AYAH_LABEL } from "@/domain/quran";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  it("keeps Quran text Arabic and RTL independently of interface layout", () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <HomePage />
        </LocaleProvider>
      </MemoryRouter>,
    );

    const snippet = screen.getByText(DEMO_AYAH_LABEL);
    expect(snippet).toHaveAttribute("lang", "ar");
    expect(snippet).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("link", { name: /ابدأ القراءة/ })).toHaveAttribute(
      "href",
      "/quran/page/1",
    );
  });
});
