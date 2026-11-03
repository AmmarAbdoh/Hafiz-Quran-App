// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "@/app/i18n";
import { ReciterProvider } from "@/domain/quran";
import { ThemeProvider } from "@/shared/hooks/use-theme";
import { safeStorage, STORAGE_KEYS } from "@/shared/storage";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage preferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("persists language, theme, and tafsir choices", async () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <ThemeProvider>
            <ReciterProvider>
              <SettingsPage />
            </ReciterProvider>
          </ThemeProvider>
        </LocaleProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "English" }));
    await waitFor(() =>
      expect(screen.getByText("Settings")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("tab", { name: "Dark" }));
    fireEvent.change(screen.getByLabelText("Default tafsir"), {
      target: { value: "4" },
    });

    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
    expect(safeStorage.getItem(STORAGE_KEYS.locale)).toBe("en");
    expect(safeStorage.getItem(STORAGE_KEYS.theme)).toBe("dark");
    expect(safeStorage.getItem(STORAGE_KEYS.tafseer)).toBe("4");
  });

  /* Not ready to offer; see `STRICT_MODE_AVAILABLE`. */
  it("keeps strict reciter mode out of the practice settings", async () => {
    render(
      <MemoryRouter>
        <LocaleProvider>
          <ThemeProvider>
            <ReciterProvider>
              <SettingsPage />
            </ReciterProvider>
          </ThemeProvider>
        </LocaleProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: "English" }));
    await waitFor(() =>
      expect(screen.getByText("Settings")).toBeInTheDocument(),
    );

    expect(
      screen.queryByRole("switch", { name: "Correct me strictly" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Correct me strictly")).not.toBeInTheDocument();
  });
});
