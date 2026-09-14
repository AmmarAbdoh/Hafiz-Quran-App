// @vitest-environment jsdom

import { quranRepository } from "@/domain/quran/data";
import type { QuranCoreData } from "@/domain/quran/data/types";
import { prefetchAfterFirstPaint } from "./prefetch";

const core: QuranCoreData = {
  schemaVersion: 1,
  mushafVerses: [],
  verseInfo: [],
  uthmaniVerses: [],
  simpleVerses: [],
  chapterSimpleVerses: [],
  imlaeiVerses: [],
  imlaeiCleanedVerses: [],
};

function reportConnection(value: unknown) {
  Object.defineProperty(navigator, "connection", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "connection");
});

describe("prefetchAfterFirstPaint", () => {
  it("warms the core dataset and the first reader page once idle", async () => {
    reportConnection({ effectiveType: "4g" });
    const loadCoreData = vi
      .spyOn(quranRepository, "loadCoreData")
      .mockResolvedValue(core);
    const loadPageLayout = vi
      .spyOn(quranRepository, "loadPageLayout")
      .mockResolvedValue({ page: 1, lines: [] });
    vi.useFakeTimers();

    prefetchAfterFirstPaint();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(loadCoreData).toHaveBeenCalled();
    expect(loadPageLayout).toHaveBeenCalledWith(1);
  });

  it("leaves the dataset alone on data saver connections", async () => {
    reportConnection({ saveData: true });
    const loadCoreData = vi.spyOn(quranRepository, "loadCoreData");
    vi.useFakeTimers();

    prefetchAfterFirstPaint();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(loadCoreData).not.toHaveBeenCalled();
  });

  it("leaves the dataset alone on very slow connections", async () => {
    reportConnection({ effectiveType: "2g" });
    const loadCoreData = vi.spyOn(quranRepository, "loadCoreData");
    vi.useFakeTimers();

    prefetchAfterFirstPaint();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(loadCoreData).not.toHaveBeenCalled();
  });
});
