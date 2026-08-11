import type {
  BuiltListenSession,
  ListenPlan,
  ListenPlanValidationError,
  ListenPreset,
  PlaylistItem,
} from "@/features/quran-reader/model/listenPlanTypes";
import { SURAH_AYAH_COUNTS } from "@/domain/quran";
import {
  findMushafVerse,
  getSurahAyahCount,
  getVersesForPage,
} from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";

function verseKey(surah: number, ayah: number): string {
  return `${surah}:${ayah}`;
}

function uniqueAyahsFromVerses(verses: MushafVerse[]): PlaylistItem[] {
  const seen = new Set<string>();
  const items: PlaylistItem[] = [];

  for (const verse of verses) {
    const key = verseKey(verse.sura_no, verse.aya_no);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ surah: verse.sura_no, ayah: verse.aya_no });
  }

  return items;
}

function buildAyahRangePlaylist(
  mushafData: MushafVerse[],
  startSurah: number,
  startAyah: number,
  endSurah: number,
  endAyah: number,
): PlaylistItem[] {
  const startKey = verseKey(startSurah, startAyah);
  const endKey = verseKey(endSurah, endAyah);
  let started = false;
  const items: PlaylistItem[] = [];

  for (const verse of mushafData) {
    const key = verseKey(verse.sura_no, verse.aya_no);
    if (key === startKey) started = true;
    if (!started) continue;

    items.push({ surah: verse.sura_no, ayah: verse.aya_no });
    if (key === endKey) break;
  }

  return items;
}

function buildSurahPlaylist(
  mushafData: MushafVerse[],
  surah: number,
  fromAyah = 1,
): PlaylistItem[] {
  const maxAyah = getSurahAyahCount(mushafData, surah);
  const items: PlaylistItem[] = [];

  for (let ayah = fromAyah; ayah <= maxAyah; ayah++) {
    if (findMushafVerse(mushafData, surah, ayah)) {
      items.push({ surah, ayah });
    }
  }

  return items;
}

function buildJuzPlaylist(
  mushafData: MushafVerse[],
  juz: number,
): PlaylistItem[] {
  return uniqueAyahsFromVerses(
    mushafData.filter((verse) => verse.jozz === juz),
  );
}

function buildPagePlaylist(
  mushafData: MushafVerse[],
  page: number,
): PlaylistItem[] {
  return uniqueAyahsFromVerses(getVersesForPage(mushafData, page));
}

function buildPageRangePlaylist(
  mushafData: MushafVerse[],
  fromPage: number,
  toPage: number,
): PlaylistItem[] {
  const items: PlaylistItem[] = [];

  for (let page = fromPage; page <= toPage; page++) {
    items.push(...buildPagePlaylist(mushafData, page));
  }

  return items;
}

export function buildListenSession(
  plan: ListenPlan,
  mushafData: MushafVerse[],
): BuiltListenSession | null {
  let playlist: PlaylistItem[] = [];
  let repeatEachAyah = false;

  switch (plan.scope) {
    case "ayah": {
      if (!plan.surah || !plan.ayah) return null;
      if (!findMushafVerse(mushafData, plan.surah, plan.ayah)) return null;
      playlist = [{ surah: plan.surah, ayah: plan.ayah }];
      repeatEachAyah = plan.repeatMode !== "none";
      break;
    }
    case "ayah-range": {
      if (!plan.surah || !plan.ayah || !plan.endSurah || !plan.endAyah) {
        return null;
      }
      playlist = buildAyahRangePlaylist(
        mushafData,
        plan.surah,
        plan.ayah,
        plan.endSurah,
        plan.endAyah,
      );
      break;
    }
    case "page": {
      if (!plan.page) return null;
      playlist = buildPagePlaylist(mushafData, plan.page);
      break;
    }
    case "page-range": {
      if (!plan.page || !plan.endPage) return null;
      playlist = buildPageRangePlaylist(mushafData, plan.page, plan.endPage);
      break;
    }
    case "surah": {
      if (!plan.surah) return null;
      playlist = buildSurahPlaylist(mushafData, plan.surah, plan.ayah ?? 1);
      break;
    }
    case "juz": {
      if (!plan.juz) return null;
      playlist = buildJuzPlaylist(mushafData, plan.juz);
      break;
    }
    default:
      return null;
  }

  if (playlist.length === 0) return null;

  return {
    playlist,
    repeatMode: plan.repeatMode,
    repeatCount: Math.max(1, plan.repeatCount),
    repeatEachAyah,
    plan: { ...plan },
  };
}

export function validateListenPlan(
  plan: ListenPlan,
  mushafData: MushafVerse[],
  totalPages: number,
): ListenPlanValidationError | null {
  const inSurah = (surah: number, ayah: number) => {
    if (surah < 1 || surah > 114) return false;
    const max =
      SURAH_AYAH_COUNTS[surah - 1] ?? getSurahAyahCount(mushafData, surah);
    return (
      ayah >= 1 &&
      ayah <= max &&
      Boolean(findMushafVerse(mushafData, surah, ayah))
    );
  };

  switch (plan.scope) {
    case "ayah":
      if (!plan.surah || !plan.ayah || !inSurah(plan.surah, plan.ayah)) {
        return "invalidAyah";
      }
      return null;
    case "ayah-range": {
      if (
        !plan.surah ||
        !plan.ayah ||
        !plan.endSurah ||
        !plan.endAyah ||
        !inSurah(plan.surah, plan.ayah) ||
        !inSurah(plan.endSurah, plan.endAyah)
      ) {
        return "invalidAyahRange";
      }
      const startIdx = mushafData.findIndex(
        (v) => v.sura_no === plan.surah && v.aya_no === plan.ayah,
      );
      const endIdx = mushafData.findIndex(
        (v) => v.sura_no === plan.endSurah && v.aya_no === plan.endAyah,
      );
      if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
        return "reversedAyahRange";
      }
      return null;
    }
    case "page":
      if (!plan.page || plan.page < 1 || plan.page > totalPages) {
        return "invalidPage";
      }
      return null;
    case "page-range": {
      if (
        !plan.page ||
        !plan.endPage ||
        plan.page < 1 ||
        plan.endPage > totalPages ||
        plan.page > plan.endPage
      ) {
        return "invalidPageRange";
      }
      return null;
    }
    case "surah":
      if (!plan.surah || plan.surah < 1 || plan.surah > 114) {
        return "invalidSurah";
      }
      if (plan.ayah && !inSurah(plan.surah, plan.ayah)) {
        return "invalidSurahAyah";
      }
      return null;
    case "juz":
      if (!plan.juz || plan.juz < 1 || plan.juz > 30) {
        return "invalidJuz";
      }
      return null;
    default:
      return "unsupportedScope";
  }
}

export function defaultPlanFromPreset(
  preset: ListenPreset | null | undefined,
): ListenPlan {
  if (!preset) {
    return {
      scope: "surah",
      surah: 1,
      ayah: 1,
      repeatMode: "none",
      repeatCount: 1,
    };
  }

  if (preset.scope === "surah" && preset.surah) {
    return {
      scope: "surah",
      surah: preset.surah,
      ayah: preset.ayah ?? 1,
      repeatMode: "none",
      repeatCount: 1,
    };
  }

  if (preset.scope === "juz" || preset.juz) {
    return {
      scope: "juz",
      juz: preset.juz ?? 1,
      repeatMode: "none",
      repeatCount: 1,
    };
  }

  if (preset.scope === "page" || preset.page) {
    return {
      scope: "page",
      page: preset.page ?? 1,
      endPage: preset.page ?? 1,
      repeatMode: "none",
      repeatCount: 1,
    };
  }

  if (preset.surah && preset.ayah) {
    return {
      scope: "ayah",
      surah: preset.surah,
      ayah: preset.ayah,
      repeatMode: "none",
      repeatCount: 1,
    };
  }

  if (preset.surah) {
    return {
      scope: "surah",
      surah: preset.surah,
      ayah: 1,
      repeatMode: "none",
      repeatCount: 1,
    };
  }

  return {
    scope: "surah",
    surah: 1,
    ayah: 1,
    repeatMode: "none",
    repeatCount: 1,
  };
}
