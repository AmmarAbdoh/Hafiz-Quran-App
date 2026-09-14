// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LocaleProvider } from "@/app/i18n";
import { ThemeProvider } from "@/shared/hooks/use-theme";
import { MushafReaderHeader } from "./MushafReaderHeader";

const noop = () => {};

function renderHeader(
  overrides: Partial<Parameters<typeof MushafReaderHeader>[0]> = {},
) {
  const onOpenReadingPreferences = vi.fn();
  const onOpenListenOptions = vi.fn();
  const onOpenSurahDrawer = vi.fn();
  const onOpenAyahSearch = vi.fn();
  render(
    <MemoryRouter initialEntries={["/quran/page/5"]}>
      <LocaleProvider>
        <ThemeProvider>
          <Routes>
            <Route path="/" element={<p>home route</p>} />
            <Route
              path="/quran/page/:page"
              element={
                <MushafReaderHeader
                  surahLabel="البقرة"
                  page={5}
                  practiceActive={false}
                  practiceLoading={false}
                  onOpenSurahDrawer={onOpenSurahDrawer}
                  onOpenAyahSearch={onOpenAyahSearch}
                  onOpenListenOptions={onOpenListenOptions}
                  onOpenReadingPreferences={onOpenReadingPreferences}
                  onTogglePractice={noop}
                  {...overrides}
                />
              }
            />
          </Routes>
        </ThemeProvider>
      </LocaleProvider>
    </MemoryRouter>,
  );
  return {
    onOpenReadingPreferences,
    onOpenListenOptions,
    onOpenSurahDrawer,
    onOpenAyahSearch,
  };
}

async function openMenu() {
  const trigger = screen.getByRole("button", { name: "خيارات القراءة" });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "ArrowDown" });
  await waitFor(() => {
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);
  });
}

describe("MushafReaderHeader", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  });

  it("leaves the reader for the home page rather than the previous route", async () => {
    renderHeader();

    fireEvent.click(screen.getByRole("link", { name: "الرئيسية" }));

    expect(await screen.findByText("home route")).toBeInTheDocument();
  });

  it("names the surah and page being read", () => {
    renderHeader();

    const surah = screen.getByText("البقرة");
    expect(surah).toHaveAttribute("lang", "ar");
    expect(surah).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("صفحة ٥")).toBeInTheDocument();
  });

  it("shows the page alone until the surah names arrive", () => {
    renderHeader({ surahLabel: "" });

    expect(screen.getByText("صفحة ٥")).toBeInTheDocument();
  });

  it("opens reading preferences from the overflow menu", async () => {
    const { onOpenReadingPreferences } = renderHeader();

    await openMenu();

    const preferences = await screen.findByRole("menuitem", {
      name: /تفضيلات القراءة/,
    });
    fireEvent.click(preferences);

    expect(onOpenReadingPreferences).toHaveBeenCalled();
  });

  it("exposes listen, surahs, and search from the overflow menu", async () => {
    const { onOpenListenOptions, onOpenSurahDrawer, onOpenAyahSearch } =
      renderHeader();

    await openMenu();

    fireEvent.click(await screen.findByRole("menuitem", { name: /استماع/ }));
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /السور/ }));
    await openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: /بحث آية/ }));

    // Called with no argument so the menu event cannot pose as a listen preset.
    expect(onOpenListenOptions).toHaveBeenCalledWith();
    expect(onOpenSurahDrawer).toHaveBeenCalled();
    expect(onOpenAyahSearch).toHaveBeenCalled();
  });
});
