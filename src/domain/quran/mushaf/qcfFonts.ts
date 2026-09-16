import { useEffect, useState } from "react";
import type { Theme } from "@/shared/hooks/use-theme";

const CDN_BASE = "https://verses.quran.foundation";
/** CPAL light palette: indices 1, 2, 15 are sakin / silent-letter grey (#a5a5a5). */
const TAJWEED_SAKIN_LIGHT_GREY = "#4a4a4a";
const loadedFonts = new Map<string, Promise<boolean>>();
const injectedPalettes = new Set<string>();
/**
 * Families this module has added to the document. `document.fonts.check` cannot
 * answer that question: it reports whether the text would render at all, so it
 * returns true for a family that was never loaded and the page would then draw
 * its glyphs in a fallback face and reflow once the real font arrived.
 */
const documentFontFamilies = new Set<string>();

/**
 * Keyed on the file, not on the theme.
 *
 * The key used to carry the theme unconditionally, while getFontUrl varies by
 * theme in exactly one case - Firefox, dark, coloured. So on every other
 * browser, switching theme threw away the cached face for every visible page
 * and re-registered it against a byte-identical URL. In plain mode the file
 * never depends on the theme at all.
 *
 * The tajweed colours do follow the theme, but through the CSS font-palette
 * property, which needs no new font.
 */
function getFontCacheKey(page: number, theme: Theme, colored: boolean): string {
  return `${getQcfFontFamily(page, colored)}|${getFontUrl(page, theme, colored)}`;
}

function isQcfFontInDocument(page: number, colored: boolean): boolean {
  return documentFontFamilies.has(getQcfFontFamily(page, colored));
}

function isFirefox(): boolean {
  return (
    typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox")
  );
}

function getQcfFontFamily(page: number, colored: boolean): string {
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

function getMushafFontPalette(fontFamily: string, theme: Theme): string {
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
      documentFontFamilies.add(fontFamily);
      if (colored) ensureTajweedPalettes(fontFamily);
      return true;
    } catch {
      loadedFonts.delete(cacheKey);
      return false;
    }
  })();

  loadedFonts.set(cacheKey, promise);
  return promise;
}

function preloadAdjacentQcfPageFonts(
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
  const [ready, setReady] = useState(() => isQcfFontInDocument(page, colored));
  const [failed, setFailed] = useState(false);

  const fontPalette = colored
    ? getMushafFontPalette(fontFamily, theme)
    : undefined;

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setReady(isQcfFontInDocument(page, colored));
      setFailed(false);
      return;
    }

    if (isQcfFontInDocument(page, colored)) {
      setReady(true);
      setFailed(false);
      return;
    }

    const cacheKey = getFontCacheKey(page, theme, colored);
    const cached = loadedFonts.get(cacheKey);
    if (cached) {
      void cached.then((loaded) => {
        if (!cancelled) {
          setReady(loaded);
          setFailed(!loaded);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    setReady(false);
    setFailed(false);
    void preloadQcfPageFont(page, theme, colored).then((loaded) => {
      if (!cancelled) {
        setReady(loaded);
        setFailed(!loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [page, theme, colored, enabled]);

  return { fontFamily, fontPalette, ready, colored, failed };
}
