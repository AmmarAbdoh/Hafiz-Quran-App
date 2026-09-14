// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { LocaleProvider } from "@/app/i18n";
import { QuranDataProvider, useQuranData } from "./QuranDataProvider";
import { quranRepository } from "./data";
import type { MushafVerse } from "./data";
import type { QuranCoreData } from "./data/types";

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
  aya_text: "بسم الله",
  aya_text_emlaey: "بسم الله",
};

const core = {
  schemaVersion: 1,
  mushafVerses: [verse],
  verseInfo: [],
  uthmaniVerses: [],
  simpleVerses: [],
  chapterSimpleVerses: [],
  imlaeiVerses: [],
  imlaeiCleanedVerses: [],
} satisfies QuranCoreData;

function DataProbe() {
  const { loading, mushafData } = useQuranData();
  return (
    <p>
      {loading ? "loading" : "ready"}:{mushafData.length}
    </p>
  );
}

function renderProvider() {
  render(
    <LocaleProvider>
      <QuranDataProvider>
        <DataProbe />
      </QuranDataProvider>
    </LocaleProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("QuranDataProvider", () => {
  it("reports loading until core data arrives", async () => {
    vi.spyOn(quranRepository, "peekCoreData").mockReturnValue(null);
    vi.spyOn(quranRepository, "loadCoreData").mockResolvedValue(core);

    renderProvider();

    expect(screen.getByText("loading:0")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("ready:1")).toBeInTheDocument(),
    );
  });

  it("renders cached core data on the first frame without a loading state", () => {
    vi.spyOn(quranRepository, "peekCoreData").mockReturnValue(core);
    const loadCoreData = vi.spyOn(quranRepository, "loadCoreData");

    renderProvider();

    expect(screen.getByText("ready:1")).toBeInTheDocument();
    expect(screen.queryByText("loading:0")).not.toBeInTheDocument();
    expect(loadCoreData).not.toHaveBeenCalled();
  });
});
