import {
  findMushafVerse,
  getPageSurahNumbers,
  TOTAL_MUSHAF_PAGES,
} from "@/domain/quran";
import { SURAH_AYAH_COUNTS } from "@/domain/quran/audio/reciters";
import type { MushafVerse } from "@/domain/quran";

const MAX_SURAHS = 114;

export interface QuranRouteParams {
  first?: string;
  second?: string;
  pageNumber?: string;
  surahNumber?: string;
  ayahNumber?: string;
}

export type MushafLayoutMode = "page" | "surah";

export type QuranRouteContext =
  | { type: "surah"; surah: number }
  | { type: "page"; page: number; surah?: number }
  | { type: "ayah"; surah: number; ayah: number };

const EXPLICIT_AYAH_PATH_RE = /^\/quran\/surah\/(\d{1,3})\/ayah\/(\d{1,3})$/;
const EXPLICIT_PAGE_PATH_RE = /^\/quran\/page\/(\d{1,3})$/;
const EXPLICIT_SURAH_PATH_RE = /^\/quran\/surah\/(\d{1,3})$/;

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(totalPages, Math.max(1, Math.round(page)));
}

export function clampSurah(surah: number): number {
  if (!Number.isFinite(surah)) return 1;
  return Math.min(MAX_SURAHS, Math.max(1, Math.round(surah)));
}

export function buildQuranReaderPath(page: number): string {
  return `/quran/page/${Math.max(1, Math.round(page))}`;
}

export function buildQuranSurahPath(surahNumber: number): string {
  return `/quran/surah/${clampSurah(surahNumber)}`;
}

function clampAyah(surah: number, ayah: number): number {
  if (!Number.isFinite(ayah)) return 1;
  const maxAyah = SURAH_AYAH_COUNTS[clampSurah(surah) - 1] ?? 1;
  return Math.min(maxAyah, Math.max(1, Math.round(ayah)));
}

export function buildQuranAyahPath(
  surahNumber: number,
  ayahNumber: number,
): string {
  const surah = clampSurah(surahNumber);
  return `/quran/surah/${surah}/ayah/${clampAyah(surah, ayahNumber)}`;
}

export function isQuranReaderPath(pathname: string): boolean {
  return pathname === "/quran" || pathname.startsWith("/quran/");
}

function parseStrictInteger(segment: string): number | null {
  if (!/^\d+$/.test(segment)) return null;
  const value = Number(segment);
  return Number.isSafeInteger(value) ? value : null;
}

/** Normalize a canonical reader URL before any Quran provider mounts. */
export function normalizeCanonicalReaderPath(
  pathname: string,
  totalPages = TOTAL_MUSHAF_PAGES,
): string | null {
  const pageMatch = /^\/quran\/page\/([^/]+)$/.exec(pathname);
  if (pageMatch) {
    const page = parseStrictInteger(pageMatch[1]!) ?? 1;
    const target = buildQuranReaderPath(clampPage(page, totalPages));
    return target === pathname ? null : target;
  }

  const ayahMatch = /^\/quran\/surah\/([^/]+)\/ayah\/([^/]+)$/.exec(pathname);
  if (ayahMatch) {
    const surah = parseStrictInteger(ayahMatch[1]!) ?? 1;
    const ayah = parseStrictInteger(ayahMatch[2]!) ?? 1;
    const target = buildQuranAyahPath(surah, ayah);
    return target === pathname ? null : target;
  }

  const surahMatch = /^\/quran\/surah\/([^/]+)$/.exec(pathname);
  if (surahMatch) {
    const surah = parseStrictInteger(surahMatch[1]!) ?? 1;
    const target = buildQuranSurahPath(surah);
    return target === pathname ? null : target;
  }

  return null;
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

  return { surah, ayah: clampAyah(surah, ayah) };
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

  const explicitPage = EXPLICIT_PAGE_PATH_RE.exec(pathname);
  if (explicitPage) {
    return { type: "page", page: Number.parseInt(explicitPage[1]!, 10) };
  }

  const explicitSurah = EXPLICIT_SURAH_PATH_RE.exec(pathname);
  if (explicitSurah) {
    return {
      type: "surah",
      surah: clampSurah(Number.parseInt(explicitSurah[1]!, 10)),
    };
  }

  if (params.surahNumber && params.ayahNumber) {
    return {
      type: "ayah",
      surah: clampSurah(Number.parseInt(params.surahNumber, 10)),
      ayah: Math.max(1, Number.parseInt(params.ayahNumber, 10)),
    };
  }

  if (params.pageNumber) {
    return {
      type: "page",
      page: Math.max(1, Number.parseInt(params.pageNumber, 10)),
    };
  }

  if (params.surahNumber) {
    return {
      type: "surah",
      surah: clampSurah(Number.parseInt(params.surahNumber, 10)),
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

/** Full navigation when switching between surah and page layouts. */
export function assignQuranReaderLayout(
  layout: MushafLayoutMode,
  page: number,
  surahNumber: number,
): void {
  const path =
    layout === "surah"
      ? buildQuranSurahPath(surahNumber)
      : buildQuranReaderPath(page);
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
    if (route.surah) return route.surah;
    const surahsOnPage = getPageSurahNumbers(mushafData, page);
    return surahsOnPage[0] ?? 1;
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
  return buildQuranReaderPath(page);
}

/** Legacy paths → current routes */
export function legacyQuranPathRedirect(pathname: string): string | null {
  if (
    parseExplicitAyahPath(pathname) ||
    EXPLICIT_PAGE_PATH_RE.test(pathname) ||
    EXPLICIT_SURAH_PATH_RE.test(pathname)
  ) {
    return null;
  }

  const scroll = pathname.match(/^\/quran\/scroll(?:\/(\d+))?$/);
  if (scroll) {
    const page = scroll[1] ? Number.parseInt(scroll[1], 10) : 1;
    return Number.isFinite(page) && page >= 1
      ? buildQuranReaderPath(page)
      : buildQuranReaderPath(1);
  }

  const pageSurah = pathname.match(/^\/quran\/page\/(\d+)\/surah\/(\d+)$/);
  if (pageSurah) {
    return buildQuranReaderPath(Number.parseInt(pageSurah[1]!, 10));
  }

  const ayah = pathname.match(/^\/quran\/surah\/(\d+)\/ayah\/(\d+)$/);
  if (ayah) {
    return null;
  }

  const legacyPair = /^\/quran\/(\d+)\/(\d+)$/.exec(pathname);
  if (legacyPair) {
    const first = Number.parseInt(legacyPair[1]!, 10);
    const second = Number.parseInt(legacyPair[2]!, 10);
    return first <= MAX_SURAHS && second > MAX_SURAHS
      ? buildQuranAyahPath(first, second)
      : buildQuranReaderPath(first);
  }

  const legacySurah = /^\/quran\/(\d+)$/.exec(pathname);
  if (legacySurah) {
    return buildQuranSurahPath(Number.parseInt(legacySurah[1]!, 10));
  }

  return null;
}
