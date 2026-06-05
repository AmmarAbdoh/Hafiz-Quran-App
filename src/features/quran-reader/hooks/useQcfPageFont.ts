import { useEffect, useState } from "react";
import type { Theme } from "@/shared/hooks/use-theme";

const CDN_BASE = "https://verses.quran.foundation";
const loadedFonts = new Map<string, Promise<boolean>>();
const injectedPalettes = new Set<string>();

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
    }
    @font-palette-values --Mushaf-Tajweed-Dark-${fontFamily} {
      font-family: '${fontFamily}';
      base-palette: 1;
    }
  `;
  document.head.appendChild(style);
  injectedPalettes.add(fontFamily);
}

async function loadQcfPageFont(
  page: number,
  theme: Theme,
  colored: boolean,
): Promise<boolean> {
  const fontFamily = getQcfFontFamily(page, colored);
  const cacheKey = `${fontFamily}-${theme}-${colored ? "c" : "p"}`;
  const cached = loadedFonts.get(cacheKey);
  if (cached) return cached;

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

export function useQcfPageFont(
  page: number,
  options: { colored: boolean; theme: Theme },
) {
  const { colored, theme } = options;
  const fontFamily = getQcfFontFamily(page, colored);
  const [ready, setReady] = useState(false);

  const fontPalette = colored
    ? getMushafFontPalette(fontFamily, theme)
    : undefined;

  useEffect(() => {
    let cancelled = false;
    setReady(false);

    loadQcfPageFont(page, theme, colored).then((loaded) => {
      if (!cancelled) setReady(loaded);
    });

    return () => {
      cancelled = true;
    };
  }, [page, theme, colored]);

  return { fontFamily, fontPalette, ready, colored };
}
