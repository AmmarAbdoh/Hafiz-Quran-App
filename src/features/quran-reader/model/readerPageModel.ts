import type {
  MushafPageLayout,
  MushafVerse,
  VerseInfoRecord,
} from "@/domain/quran";
import {
  buildMushafPageItemsForSurah,
  getFirstVerseOnPage,
  getPageSurahNumbers,
  getSurahAyahCount,
  getSurahPages,
  getSurahTashkeelName,
} from "@/domain/quran";
import {
  getQuranRouteContext,
  resolveLayoutMode,
  resolveReaderPage,
  resolveReaderSurahNumber,
  type MushafLayoutMode,
  type QuranRouteContext,
  type QuranRouteParams,
} from "@/features/quran-reader/model/quranReaderRoutes";

interface ReaderRouteState {
  routeContext: QuranRouteContext;
  layoutMode: MushafLayoutMode;
  currentPage: number;
  currentSurahNumber: number;
  currentSurahIndex: number;
}

interface ReaderSurahLayoutState {
  pages: number[];
  pageLayouts: MushafPageLayout[];
  bounds: { min: number; max: number };
}

interface ReaderMetadata {
  surahNames: string[];
  surahAyahCount?: number;
  juzNumber?: number;
  hizbNumber?: number;
}

interface SelectReaderRouteStateOptions {
  pathname: string;
  params: QuranRouteParams;
  mushafData: MushafVerse[];
  totalPages: number;
}

interface SelectReaderMetadataOptions {
  layoutMode: MushafLayoutMode;
  currentPage: number;
  currentSurahNumber: number;
  visibleSurahPage: number;
  mushafData: MushafVerse[];
  verseInfoRecords: VerseInfoRecord[];
}

export function selectReaderRouteState({
  pathname,
  params,
  mushafData,
  totalPages,
}: SelectReaderRouteStateOptions): ReaderRouteState {
  const routeContext = getQuranRouteContext(pathname, params);
  const layoutMode = resolveLayoutMode(params, pathname);
  const currentPage = resolveReaderPage(
    params,
    mushafData,
    totalPages,
    pathname,
  );
  const currentSurahNumber = resolveReaderSurahNumber(
    params,
    mushafData,
    currentPage,
    pathname,
  );

  return {
    routeContext,
    layoutMode,
    currentPage,
    currentSurahNumber,
    currentSurahIndex: currentSurahNumber - 1,
  };
}

export function selectReaderSurahLayout(
  mushafData: MushafVerse[],
  loadedPageLayouts: MushafPageLayout[],
  surahNumber: number,
  totalPages: number,
): ReaderSurahLayoutState {
  if (mushafData.length === 0 || loadedPageLayouts.length === 0) {
    return {
      pages: [],
      pageLayouts: [],
      bounds: { min: 1, max: totalPages },
    };
  }

  const layoutsByPage = new Map(
    loadedPageLayouts.map((layout) => [layout.page, layout]),
  );
  const pageLayouts: MushafPageLayout[] = [];
  const pages = getSurahPages(mushafData, surahNumber).filter((page) => {
    const pageLayout = layoutsByPage.get(page);
    const containsSurah = Boolean(
      pageLayout &&
      buildMushafPageItemsForSurah(pageLayout, surahNumber).length > 0,
    );
    if (containsSurah) pageLayouts.push(pageLayout!);
    return containsSurah;
  });

  if (pages.length === 0) {
    return {
      pages,
      pageLayouts,
      bounds: { min: 1, max: totalPages },
    };
  }

  return {
    pages,
    pageLayouts,
    bounds: { min: pages[0]!, max: pages[pages.length - 1]! },
  };
}

export function selectReaderMetadata({
  layoutMode,
  currentPage,
  currentSurahNumber,
  visibleSurahPage,
  mushafData,
  verseInfoRecords,
}: SelectReaderMetadataOptions): ReaderMetadata {
  if (layoutMode === "surah") {
    const visibleVerse = mushafData.find(
      (verse) =>
        verse.page === visibleSurahPage && verse.sura_no === currentSurahNumber,
    );
    const firstSurahVerse = mushafData.find(
      (verse) => verse.sura_no === currentSurahNumber && verse.aya_no === 1,
    );
    const verseInfo = findVerseInfoRecord(
      visibleVerse ?? firstSurahVerse,
      verseInfoRecords,
    );

    return {
      surahNames: [getSurahTashkeelName(mushafData, currentSurahNumber)],
      surahAyahCount: getSurahAyahCount(mushafData, currentSurahNumber),
      juzNumber: verseInfo?.juz_number,
    };
  }

  const firstVerse = getFirstVerseOnPage(mushafData, currentPage);
  const pageSurahs = getPageSurahNumbers(mushafData, currentPage);
  const verseInfo = findVerseInfoRecord(firstVerse, verseInfoRecords);

  return {
    surahNames: pageSurahs.map((surahNumber) =>
      getSurahTashkeelName(mushafData, surahNumber),
    ),
    surahAyahCount:
      pageSurahs.length === 1
        ? getSurahAyahCount(mushafData, pageSurahs[0]!)
        : undefined,
    juzNumber: verseInfo?.juz_number,
    hizbNumber: verseInfo?.hizb_number,
  };
}

export function findVersePage(
  mushafData: MushafVerse[],
  verseKey: string,
): number | null {
  const [surahPart, ayahPart] = verseKey.split(":");
  const surah = Number.parseInt(surahPart ?? "", 10);
  const ayah = Number.parseInt(ayahPart ?? "", 10);
  if (!Number.isFinite(surah) || !Number.isFinite(ayah)) return null;

  return (
    mushafData.find((verse) => verse.sura_no === surah && verse.aya_no === ayah)
      ?.page ?? null
  );
}

function findVerseInfoRecord(
  verse: MushafVerse | undefined,
  records: VerseInfoRecord[],
): VerseInfoRecord | undefined {
  if (!verse) return undefined;
  return records.find((record) => record.id === verse.id);
}
