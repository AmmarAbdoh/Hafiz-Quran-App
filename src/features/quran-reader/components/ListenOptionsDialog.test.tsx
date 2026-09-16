// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import type { MushafVerse } from "@/domain/quran";
import { ListenOptionsDialog } from "./ListenOptionsDialog";

const startListening = vi.fn();

vi.mock("@/features/quran-reader/context/QuranPlaybackContext", () => ({
  useQuranPlaybackActions: () => ({ startListening }),
}));

function makeVerse(surah: number, ayah: number, page: number): MushafVerse {
  return {
    id: surah * 1000 + ayah,
    jozz: 1,
    page,
    sura_no: surah,
    sura_name_en: "Al-Baqarah",
    sura_name_ar: "البقرة",
    line_start: 1,
    line_end: 1,
    aya_no: ayah,
    aya_text: "آية",
    aya_text_emlaey: "اية",
  };
}

const mushafData = [
  makeVerse(1, 1, 1),
  makeVerse(2, 1, 7),
  makeVerse(2, 2, 7),
  makeVerse(2, 3, 8),
];

function renderDialog(overrides: Record<string, unknown> = {}) {
  render(
    <LocaleProvider>
      <ListenOptionsDialog
        open
        onOpenChange={() => {}}
        mushafData={mushafData}
        totalPages={604}
        currentPage={7}
        currentSurahNumber={2}
        layoutMode="page"
        {...overrides}
      />
    </LocaleProvider>,
  );
}

describe("ListenOptionsDialog", () => {
  beforeEach(() => {
    startListening.mockReset();
    startListening.mockResolvedValue(undefined);
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    window.localStorage.setItem("artqiy.locale", "ar");
  });

  /*
   * Four tabs, six numeric inputs, a 114-row surah list and a 30-cell juz grid
   * stood between the reader and hearing anything, while three simpler audio
   * paths already existed elsewhere in the app.
   */
  it("offers what is in front of the reader before any configuration", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: /شغّل هذه الصفحة/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("صفحة ٧، من أولها")).toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("starts the current page in one tap", async () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: /شغّل هذه الصفحة/ }));

    await waitFor(() => expect(startListening).toHaveBeenCalledTimes(1));
  });

  it("offers the surah instead when the reader is reading one", () => {
    renderDialog({ layoutMode: "surah" });

    expect(
      screen.getByRole("button", { name: /شغّل هذه السورة/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/سورة البقرة، من أولها/)).toBeInTheDocument();
  });

  /*
   * A preset is already a decision - "listen to this surah" from the surah
   * drawer - so the quick action must follow it rather than the route.
   */
  it("follows a preset over the reader's own position", () => {
    renderDialog({ preset: { scope: "surah", surah: 1 } });

    expect(
      screen.getByRole("button", { name: /شغّل هذه السورة/ }),
    ).toBeInTheDocument();
  });

  it("keeps every other option one tap away", () => {
    renderDialog();

    const disclosure = screen.getByRole("button", { name: /خيارات أخرى/ });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: /ابدأ الاستماع/ }),
    ).toBeInTheDocument();
  });
});
