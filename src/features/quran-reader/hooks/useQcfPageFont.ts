import { useEffect, useState } from "react";
import type { Theme } from "@/shared/hooks/use-theme";

const CDN_BASE = "https://verses.quran.foundation";
const TAJWEED_STORAGE_KEY = "mushaf-tajweed-colored";
/** CPAL light palette: indices 1, 2, 15 are sakin / silent-letter grey (#a5a5a5). */
const TAJWEED_SAKIN_LIGHT_GREY = "#4a4a4a";
const loadedFonts = new Map<string, Promise<boolean>>();
const injectedPalettes = new Set<string>();

function readStoredTheme(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function readTajweedColored(): boolean {
  return localStorage.getItem(TAJWEED_STORAGE_KEY) === "true";
}

function getFontCacheKey(
  page: number,
  theme: Theme,
  colored: boolean,
): string {
  const fontFamily = getQcfFontFamily(page, colored);
  return `${fontFamily}-${theme}-${colored ? "c" : "p"}`;
}

function isQcfFontInDocument(page: number, colored: boolean): boolean {
  const fontFamily = getQcfFontFamily(page, colored);
  try {
    return document.fonts.check(`1em "${fontFamily}"`);
  } catch {
    return false;
  }
}

function isFirefox(): boolean {
  return (
    typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox")
  );
}

export function getQcfFontFamily(page: number, colored: boolean): string {
  return colored ? `p${page}-v4` : `p${page}-v2`;
}

function getFontUrl(page: number, theme: Theme, colored: boolean): string {
  if (colored) {
    if (isFirefox() && theme === "dark") {
      return `${CDN_BASE}/fonts/quran/hafs/v4/ot-svg/dark/woff2/p${page}.woff2`;
    }
    return `${CDN_BASE}/fonts/quran/hafs/v4/colrv1/woff2/p${page}.woff2`;
  }
  return `${CDN_BASE}/fonts/quran/hafs/v2/woff2/p${page}.woff2`;
}

export function getMushafFontPalette(
  fontFamily: string,
  theme: Theme,
): string {
  const themeLabel = theme === "dark" ? "Dark" : "Light";
  return `--Mushaf-Tajweed-${themeLabel}-${fontFamily}`;
}

function ensureTajweedPalettes(fontFamily: string): void {
  if (injectedPalettes.has(fontFamily)) return;

  const style = document.createElement("style");
  style.textContent = `
    @font-palette-values --Mushaf-Tajweed-Light-${fontFamily} {
      font-family: '${fontFamily}';
      base-palette: 0;
      override-colors:
        1 ${TAJWEED_SAKIN_LIGHT_GREY},
        2 ${TAJWEED_SAKIN_LIGHT_GREY},
        15 ${TAJWEED_SAKIN_LIGHT_GREY};
    }
    @font-palette-values --Mushaf-Tajweed-Dark-${fontFamily} {
      font-family: '${fontFamily}';
      base-palette: 1;
    }
  `;
  document.head.appendChild(style);
  injectedPalettes.add(fontFamily);
}

export async function preloadQcfPageFont(
  page: number,
  theme: Theme,
  colored: boolean,
): Promise<boolean> {
  const cacheKey = getFontCacheKey(page, theme, colored);
  const cached = loadedFonts.get(cacheKey);
  if (cached) return cached;

  const fontFamily = getQcfFontFamily(page, colored);

  const promise = (async () => {
    try {
      const fontFace = new FontFace(
        fontFamily,
        `url('${getFontUrl(page, theme, colored)}')`,
      );
      fontFace.display = "block";
      await fontFace.load();
      document.fonts.add(fontFace);
      if (colored) ensureTajweedPalettes(fontFamily);
      return true;
    } catch {
      return false;
    }
  })();

  loadedFonts.set(cacheKey, promise);
  return promise;
}

export function preloadAdjacentQcfPageFonts(
  centerPage: number,
  totalPages: number,
  theme: Theme,
  colored: boolean,
): void {
  for (let offset = -1; offset <= 2; offset++) {
    const page = centerPage + offset;
    if (page >= 1 && page <= totalPages && page !== centerPage) {
      void preloadQcfPageFont(page, theme, colored);
    }
  }
}

export function preloadInitialQcfFonts(): void {
  const theme = readStoredTheme();
  const colored = readTajweedColored();

  void preloadQcfPageFont(1, theme, colored);
  void preloadQcfPageFont(2, theme, colored);

  if (colored) {
    void preloadQcfPageFont(1, theme, false);
    void preloadQcfPageFont(2, theme, false);
  }
}

export function preloadQcfFontsForReaderPage(
  page: number,
  totalPages: number,
  theme: Theme,
  colored: boolean,
): void {
  void preloadQcfPageFont(page, theme, colored);
  preloadAdjacentQcfPageFonts(page, totalPages, theme, colored);
}

export function useQcfPageFont(
  page: number,
  options: { colored: boolean; theme: Theme; enabled?: boolean },
) {
  const { colored, theme, enabled = true } = options;
  const fontFamily = getQcfFontFamily(page, colored);
  const [ready, setReady] = useState(() =>
    isQcfFontInDocument(page, colored),
  );

  const fontPalette = colored
    ? getMushafFontPalette(fontFamily, theme)
    : undefined;

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setReady(isQcfFontInDocument(page, colored));
      return;
    }

    if (isQcfFontInDocument(page, colored)) {
      setReady(true);
      return;
    }

    const cacheKey = getFontCacheKey(page, theme, colored);
    const cached = loadedFonts.get(cacheKey);
    if (cached) {
      cached.then((loaded) => {
        if (!cancelled) setReady(loaded);
      });
      return () => {
        cancelled = true;
      };
    }

    setReady(false);
    preloadQcfPageFont(page, theme, colored).then((loaded) => {
      if (!cancelled) setReady(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [page, theme, colored, enabled]);

  return { fontFamily, fontPalette, ready, colored };
}
