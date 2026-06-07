import {
  findMushafVerse,
  getPageSurahNumbers,
} from "@/shared/services/quran-data";
import type { MushafVerse } from "@/shared/types/quran";

const MAX_SURAHS = 114;

export type QuranRouteParams = {
  first?: string;
  second?: string;
  surahNumber?: string;
  ayahNumber?: string;
};

export type MushafLayoutMode = "page" | "surah";

export type QuranRouteContext =
  | { type: "surah"; surah: number }
  | { type: "page"; page: number; surah: number }
  | { type: "ayah"; surah: number; ayah: number };

const EXPLICIT_AYAH_PATH_RE =
  /^\/quran\/surah\/(\d{1,3})\/ayah\/(\d{1,3})$/;

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(totalPages, Math.max(1, Math.round(page)));
}

export function clampSurah(surah: number): number {
  if (!Number.isFinite(surah)) return 1;
  return Math.min(MAX_SURAHS, Math.max(1, Math.round(surah)));
}

export function buildQuranReaderPath(page: number, surahNumber: number): string {
  return `/quran/${page}/${surahNumber}`;
}

export function buildQuranSurahPath(surahNumber: number): string {
  return `/quran/${clampSurah(surahNumber)}`;
}

export function buildQuranAyahPath(surahNumber: number, ayahNumber: number): string {
  return `/quran/surah/${clampSurah(surahNumber)}/ayah/${Math.max(
    1,
    Math.round(ayahNumber),
  )}`;
}

export function isQuranReaderPath(pathname: string): boolean {
  return pathname === "/quran" || pathname.startsWith("/quran/");
}

export function parseExplicitAyahPath(
  pathname: string,
): { surah: number; ayah: number } | null {
  const match = pathname.match(EXPLICIT_AYAH_PATH_RE);
  if (!match) return null;

  const surah = Number.parseInt(match[1]!, 10);
  const ayah = Number.parseInt(match[2]!, 10);
  if (
    !Number.isFinite(surah) ||
    !Number.isFinite(ayah) ||
    surah < 1 ||
    surah > MAX_SURAHS ||
    ayah < 1
  ) {
    return null;
  }

  return { surah, ayah };
}

/** Legacy short paths like /quran/2/255 (ambiguous for ayah <= 114). */
export function isLegacyAyahRoute(first?: string, second?: string): boolean {
  const surah = first ? Number.parseInt(first, 10) : NaN;
  const ayah = second ? Number.parseInt(second, 10) : NaN;
  return (
    Number.isFinite(surah) &&
    Number.isFinite(ayah) &&
    surah >= 1 &&
    surah <= MAX_SURAHS &&
    ayah > MAX_SURAHS
  );
}

/** @deprecated Use parseExplicitAyahPath or getQuranRouteContext instead. */
export function isAyahRoute(first?: string, second?: string): boolean {
  return isLegacyAyahRoute(first, second);
}

export function isPageLayoutRoute(first?: string, second?: string): boolean {
  if (!first || !second || isLegacyAyahRoute(first, second)) return false;

  const page = Number.parseInt(first, 10);
  const surah = Number.parseInt(second, 10);

  return (
    Number.isFinite(page) &&
    Number.isFinite(surah) &&
    surah >= 1 &&
    surah <= MAX_SURAHS
  );
}

export function getQuranRouteContext(
  pathname: string,
  params: QuranRouteParams,
): QuranRouteContext {
  const explicitAyah = parseExplicitAyahPath(pathname);
  if (explicitAyah) {
    return { type: "ayah", ...explicitAyah };
  }

  if (params.surahNumber && params.ayahNumber) {
    return {
      type: "ayah",
      surah: clampSurah(Number.parseInt(params.surahNumber, 10)),
      ayah: Math.max(1, Number.parseInt(params.ayahNumber, 10)),
    };
  }

  if (isLegacyAyahRoute(params.first, params.second)) {
    return {
      type: "ayah",
      surah: clampSurah(Number.parseInt(params.first!, 10)),
      ayah: Number.parseInt(params.second!, 10),
    };
  }

  if (isPageLayoutRoute(params.first, params.second)) {
    return {
      type: "page",
      page: Number.parseInt(params.first!, 10),
      surah: clampSurah(Number.parseInt(params.second!, 10)),
    };
  }

  if (params.first && Number.isFinite(Number.parseInt(params.first, 10))) {
    return {
      type: "surah",
      surah: clampSurah(Number.parseInt(params.first, 10)),
    };
  }

  return { type: "surah", surah: 1 };
}

export function resolveLayoutMode(
  params: QuranRouteParams,
  pathname = "",
): MushafLayoutMode {
  const route = getQuranRouteContext(pathname, params);
  if (route.type === "page") return "page";
  return "surah";
}

export function resolveLayoutModeFromPathname(pathname: string): MushafLayoutMode {
  if (!isQuranReaderPath(pathname)) return "surah";

  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "quran") return "surah";

  if (parseExplicitAyahPath(pathname)) return "surah";

  return resolveLayoutMode({
    first: segments[1],
    second: segments[2],
  }, pathname);
}

/** Full navigation when switching between surah and page layouts. */
export function assignQuranReaderLayout(
  layout: MushafLayoutMode,
  page: number,
  surahNumber: number,
): void {
  const path =
    layout === "surah"
      ? buildQuranSurahPath(surahNumber)
      : buildQuranReaderPath(page, surahNumber);
  window.location.assign(path);
}

export function resolveReaderSurahNumber(
  params: QuranRouteParams,
  mushafData: MushafVerse[],
  page: number,
  pathname = "",
): number {
  const route = getQuranRouteContext(pathname, params);

  if (route.type === "ayah") {
    return route.surah;
  }

  if (route.type === "page") {
    return route.surah;
  }

  if (route.type === "surah") {
    return route.surah;
  }

  if (mushafData.length > 0) {
    const surahsOnPage = getPageSurahNumbers(mushafData, page);
    if (surahsOnPage.length > 0) return surahsOnPage[0]!;
  }

  return 1;
}

export function resolveReaderPage(
  params: QuranRouteParams,
  mushafData: MushafVerse[],
  totalPages: number,
  pathname = "",
): number {
  const route = getQuranRouteContext(pathname, params);

  if (route.type === "ayah" && mushafData.length > 0) {
    const verse = findMushafVerse(mushafData, route.surah, route.ayah);
    if (verse) return clampPage(verse.page, totalPages);
  }

  if (route.type === "page") {
    return clampPage(route.page, totalPages);
  }

  if (route.type === "surah" && mushafData.length > 0) {
    const firstVerse = mushafData.find(
      (verse) => verse.sura_no === route.surah && verse.aya_no === 1,
    );
    if (firstVerse) return clampPage(firstVerse.page, totalPages);
  }

  return 1;
}

export function primarySurahOnPage(
  mushafData: MushafVerse[],
  page: number,
): number {
  const surahs = getPageSurahNumbers(mushafData, page);
  return surahs[0] ?? 1;
}

export function buildCanonicalReaderPath(
  params: QuranRouteParams,
  mushafData: MushafVerse[],
  totalPages: number,
  pathname = "",
): string {
  const route = getQuranRouteContext(pathname, params);

  if (route.type === "ayah") {
    return buildQuranAyahPath(route.surah, route.ayah);
  }

  if (route.type === "surah") {
    return buildQuranSurahPath(route.surah);
  }

  const page = resolveReaderPage(params, mushafData, totalPages, pathname);
  return buildQuranReaderPath(
    page,
    resolveReaderSurahNumber(params, mushafData, page, pathname),
  );
}

/** Legacy paths → current routes */
export function legacyQuranPathRedirect(pathname: string): string | null {
  if (parseExplicitAyahPath(pathname)) return null;

  const scroll = pathname.match(/^\/quran\/scroll(?:\/(\d+))?$/);
  if (scroll) {
    const page = scroll[1] ? Number.parseInt(scroll[1], 10) : 1;
    return Number.isFinite(page) && page >= 1
      ? `/quran/${page}/1`
      : "/quran/1";
  }

  const pageSurah = pathname.match(/^\/quran\/page\/(\d+)\/surah\/(\d+)$/);
  if (pageSurah) {
    return `/quran/${pageSurah[1]}/${pageSurah[2]}`;
  }

  const pageOnly = pathname.match(/^\/quran\/page\/(\d+)$/);
  if (pageOnly) {
    return `/quran/${pageOnly[1]}/1`;
  }

  const ayah = pathname.match(/^\/quran\/surah\/(\d+)\/ayah\/(\d+)$/);
  if (ayah) {
    return null;
  }

  const surahOnly = pathname.match(/^\/quran\/surah\/(\d+)$/);
  if (surahOnly) {
    return `/quran/${surahOnly[1]}`;
  }

  return null;
}
