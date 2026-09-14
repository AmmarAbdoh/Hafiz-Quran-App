// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("marks the current section in both adaptive navigation variants", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <AppProviders>
          <AppShell>
            <h1>صفحة الإعدادات</h1>
          </AppShell>
        </AppProviders>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("navigation", { name: "التنقل الرئيسي" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "التنقل الرئيسي للهاتف" }),
    ).toBeInTheDocument();

    const settingsLinks = screen.getAllByRole("link", { name: "المزيد" });
    expect(settingsLinks).toHaveLength(2);
    settingsLinks.forEach((link) => {
      expect(link).toHaveAttribute("aria-current", "page");
      expect(link).toHaveAttribute("href", "/settings");
    });
  });

  it("mounts reader-only state around Quran routes", () => {
    render(
      <MemoryRouter initialEntries={["/quran/page/1"]}>
        <AppProviders>
          <AppShell>
            <h1>Quran page</h1>
          </AppShell>
        </AppProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("main")).toHaveTextContent("Quran page");
    expect(document.querySelector(".reader-shell")).toBeInTheDocument();
  });
});
