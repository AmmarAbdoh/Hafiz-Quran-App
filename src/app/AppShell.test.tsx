// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "@/app/i18n";
import { ThemeProvider } from "@/shared/hooks/use-theme";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("marks the current section in both adaptive navigation variants", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <LocaleProvider>
          <ThemeProvider>
            <AppShell>
              <h1>صفحة الإعدادات</h1>
            </AppShell>
          </ThemeProvider>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("navigation", { name: "التنقل الرئيسي" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "التنقل الرئيسي للهاتف" }),
    ).toBeInTheDocument();

    const settingsLinks = screen.getAllByRole("link", { name: "الإعدادات" });
    expect(settingsLinks).toHaveLength(2);
    settingsLinks.forEach((link) => {
      expect(link).toHaveAttribute("aria-current", "page");
      expect(link).toHaveAttribute("href", "/settings");
    });
  });

  it("mounts reader-only state around Quran routes", () => {
    render(
      <MemoryRouter initialEntries={["/quran/page/1"]}>
        <LocaleProvider>
          <ThemeProvider>
            <AppShell>
              <h1>Quran page</h1>
            </AppShell>
          </ThemeProvider>
        </LocaleProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("main")).toHaveTextContent("Quran page");
    expect(document.querySelector(".reader-shell")).toBeInTheDocument();
  });
});
