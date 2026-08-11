// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider } from "@/app/i18n";
import type { MushafVerse } from "@/domain/quran";
import { VerseDialog } from "./VerseDialog";

const mocks = vi.hoisted(() => ({ loadTafseer: vi.fn() }));

vi.mock("@/domain/quran/data/quranQueries", () => ({
  loadTafseer: mocks.loadTafseer,
}));

const verse: MushafVerse = {
  id: 1,
  jozz: 1,
  page: 1,
  sura_no: 1,
  sura_name_en: "Al-Fatihah",
  sura_name_ar: "الفاتحة",
  line_start: 2,
  line_end: 2,
  aya_no: 1,
  aya_text: "بِسْمِ اللَّهِ",
  aya_text_emlaey: "بسم الله",
};

describe("VerseDialog", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("hafiz-quran.locale", "en");
    mocks.loadTafseer.mockReset();
  });

  it("retries a failed tafsir request without closing the dialog", async () => {
    mocks.loadTafseer
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("Retry result");

    render(
      <LocaleProvider>
        <VerseDialog verse={verse} open onOpenChange={() => {}} />
      </LocaleProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The tafsir could not be loaded.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Retry result")).toBeInTheDocument();
    await waitFor(() => expect(mocks.loadTafseer).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("heading", { name: "Ayah tafsir" }),
    ).toBeInTheDocument();
  });
});
