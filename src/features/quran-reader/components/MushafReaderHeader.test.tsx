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
  const onLayoutModeChange = vi.fn();
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
                  layoutMode="page"
                  practiceActive={false}
                  practiceLoading={false}
                  onLayoutModeChange={onLayoutModeChange}
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
    onLayoutModeChange,
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

  /*
   * Layout decides whether a swipe turns the page or the reader scrolls, and
   * it used to sit three levels down inside the preferences sheet, saying only
   * "surah" or "page". Opening the menu has to answer both which one is in
   * force and what each one does.
   */
  it("states the current layout and what each one does", async () => {
    renderHeader({ layoutMode: "page" });

    await openMenu();

    const pageOption = await screen.findByRole("menuitemradio", {
      name: /صفحة/,
    });
    const surahOption = await screen.findByRole("menuitemradio", {
      name: /سورة/,
    });

    expect(pageOption).toHaveAttribute("aria-checked", "true");
    expect(surahOption).toHaveAttribute("aria-checked", "false");
    expect(pageOption).toHaveTextContent("اسحب لتقليب الصفحات");
    expect(surahOption).toHaveTextContent("تمرير متواصل");

    // The name and its hint are separate blocks, and the name computed from
    // them alone runs the two together - "صفحةصفحة كاملة" - which is what a
    // screen reader would read out.
    expect(pageOption).toHaveAttribute(
      "aria-label",
      "صفحة. صفحة كاملة، اسحب لتقليب الصفحات",
    );
  });

  it("changes the layout from the overflow menu", async () => {
    const { onLayoutModeChange } = renderHeader({ layoutMode: "page" });

    await openMenu();
    fireEvent.click(await screen.findByRole("menuitemradio", { name: /سورة/ }));

    expect(onLayoutModeChange).toHaveBeenCalledWith("surah");
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
