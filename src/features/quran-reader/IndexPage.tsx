import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock3, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatNumber, useLocale } from "@/app/i18n";
import {
  buildAyahSearchIndex,
  parseAyahReference,
  searchAyahsByText,
} from "@/features/quran-reader/model/ayahTextSearch";
import {
  buildQuranAyahPath,
  buildQuranReaderPath,
  buildQuranSurahPath,
} from "@/features/quran-reader/model/quranReaderRoutes";
import {
  highlightSearchMatch,
  textMatchesSearch,
} from "@/features/quran-reader/model/searchHighlight";
import { useBookmarks } from "@/features/quran-reader/hooks/useBookmarks";
import {
  loadReaderRecents,
  recordReaderRecent,
  type ReaderRecentEntry,
} from "@/features/quran-reader/services/readerRecentsStorage";
import type { MushafVerse } from "@/domain/quran";
import { findMushafVerse, getSurahAyahCount } from "@/domain/quran";
import {
  JUZ_NAMES,
  TOTAL_MUSHAF_PAGES,
  useQuranData,
  useSurahNames,
} from "@/domain/quran";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { EmptyState } from "@/shared/components/EmptyState";
import { ListRow } from "@/shared/components/ListRow";
import { Panel } from "@/shared/components/Panel";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";

function getJuzStartPage(juz: number, mushafData: MushafVerse[]) {
  const verse = mushafData.find((entry) => entry.jozz === juz);
  return verse?.page ?? 1;
}

function navigateToRecent(
  navigate: ReturnType<typeof useNavigate>,
  entry: ReaderRecentEntry,
) {
  recordReaderRecent({
    path: entry.path,
    label: entry.label,
    surah: entry.surah,
    ayah: entry.ayah,
    page: entry.page,
  });
  void navigate(entry.path);
}

export function IndexPage() {
  const { t } = useTranslation("reader");
  const { locale } = useLocale();
  const navigate = useNavigate();
  const { mushafData, loading } = useQuranData();
  const { names, language, surahName } = useSurahNames();
  const { bookmarks } = useBookmarks();
  const [tab, setTab] = useState("surah");
  const [searchTerm, setSearchTerm] = useState("");
  const [pageInput, setPageInput] = useState("");
  const [recents, setRecents] = useState(() => loadReaderRecents());

  const search = searchTerm.trim();
  const searchIndex = useMemo(
    () => buildAyahSearchIndex(mushafData),
    [mushafData],
  );
  const ayahReference = search ? parseAyahReference(search) : null;
  const ayahMatches = useMemo(() => {
    if (!search) return [];
    if (ayahReference) {
      const verse = findMushafVerse(
        mushafData,
        ayahReference.surah,
        ayahReference.ayah,
      );
      if (!verse) return [];
      return [
        {
          surah: ayahReference.surah,
          ayah: ayahReference.ayah,
          text: verse.aya_text_emlaey.trim(),
          normalizedText: verse.aya_text_emlaey.trim(),
          score: 0,
        },
      ];
    }
    return search.length >= 2 ? searchAyahsByText(searchIndex, search, 12) : [];
  }, [ayahReference, mushafData, search, searchIndex]);

  const filteredSurahs = names
    .map((name, index) => ({ name, number: index + 1 }))
    .filter(
      ({ name, number }) =>
        textMatchesSearch(name, search) ||
        textMatchesSearch(String(number), search),
    );

  const filteredJuz = JUZ_NAMES.map((name, index) => ({
    name,
    juz: index + 1,
  })).filter(
    ({ name, juz }) =>
      textMatchesSearch(name, search) || textMatchesSearch(String(juz), search),
  );

  const bookmarkEntries = bookmarks
    .map((verseKey) => {
      const [surahText, ayahText] = verseKey.split(":");
      const surah = Number(surahText);
      const ayah = Number(ayahText);
      const verse = findMushafVerse(mushafData, surah, ayah);
      return {
        verseKey,
        surah,
        ayah,
        text: verse?.aya_text_emlaey.trim() ?? "",
      };
    })
    .filter(
      (entry) =>
        !search ||
        textMatchesSearch(surahName(entry.surah), search) ||
        textMatchesSearch(entry.text, search) ||
        textMatchesSearch(entry.verseKey, search),
    );

  const jumpToPath = (
    path: string,
    label: string,
    meta?: { surah?: number; ayah?: number; page?: number },
  ) => {
    setRecents(
      recordReaderRecent({
        path,
        label,
        ...meta,
      }),
    );
    void navigate(path);
  };

  const handleSurahSelect = (surahNumber: number) => {
    jumpToPath(buildQuranSurahPath(surahNumber), surahName(surahNumber), {
      surah: surahNumber,
    });
  };

  const handleJuzSelect = (juz: number) => {
    const page = getJuzStartPage(juz, mushafData);
    jumpToPath(buildQuranReaderPath(page), t("index.juzLabel", { juz }), {
      page,
    });
  };

  const handleAyahSelect = (surah: number, ayah: number) => {
    jumpToPath(
      buildQuranAyahPath(surah, ayah),
      t("index.ayahLabel", {
        surahName: surahName(surah),
        ayah,
      }),
      { surah, ayah },
    );
  };

  const handlePageGo = (pageValue = pageInput) => {
    const page = Number.parseInt(String(pageValue).replace(/\D/g, ""), 10);
    if (!Number.isFinite(page)) return;
    const clamped = Math.min(TOTAL_MUSHAF_PAGES, Math.max(1, page));
    jumpToPath(
      buildQuranReaderPath(clamped),
      t("index.pageLabel", { page: clamped }),
      { page: clamped },
    );
  };

  const showAyahMatches =
    (search.length >= 2 || ayahReference) &&
    (tab === "surah" || tab === "bookmarks");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Panel as="header" variant="flush" className="space-y-2">
        <h1>{t("index.title")}</h1>
        <p className="text-body text-muted-foreground">
          {t("index.description")}
        </p>
      </Panel>

      <div className="relative">
        <Search
          className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          dir="auto"
          aria-label={t("index.searchLabel")}
          placeholder={t("index.searchPlaceholder")}
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="min-h-11 ps-9"
        />
      </div>
      {search.length === 1 && !ayahReference ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t("index.searchMinLength")}
        </p>
      ) : null}

      {recents.length > 0 ? (
        <section aria-label={t("index.recentsTitle")} className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Clock3 aria-hidden className="h-4 w-4" />
            {t("index.recentsTitle")}
          </div>
          <div className="flex flex-wrap gap-2">
            {recents.map((entry) => (
              <Button
                key={`${entry.path}:${entry.visitedAt}`}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigateToRecent(navigate, entry)}
              >
                {entry.label}
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {showAyahMatches && ayahMatches.length > 0 ? (
        <section aria-label={t("index.ayahMatchesTitle")} className="space-y-2">
          <h2 className="text-sm font-semibold">
            {t("index.ayahMatchesTitle")}
          </h2>
          <div className="overflow-hidden rounded-xl border border-border">
            {ayahMatches.map((result) => (
              <ListRow
                key={`${result.surah}:${result.ayah}`}
                className="block rounded-none border-b border-border px-3 py-2.5 last:border-b-0"
                onClick={() => handleAyahSelect(result.surah, result.ayah)}
              >
                <span className="block w-full">
                  <p
                    dir="rtl"
                    lang="ar"
                    className="line-clamp-2 text-sm leading-relaxed"
                  >
                    {highlightSearchMatch(result.text, search)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("search.resultMeta", {
                      surahName: surahName(result.surah),
                      ayah: formatNumber(result.ayah, locale),
                    })}
                  </p>
                </span>
              </ListRow>
            ))}
          </div>
        </section>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1">
          <TabsTrigger value="surah" className="min-h-11 text-xs sm:text-sm">
            {t("index.tabs.surah")}
          </TabsTrigger>
          <TabsTrigger value="juz" className="min-h-11 text-xs sm:text-sm">
            {t("index.tabs.juz")}
          </TabsTrigger>
          <TabsTrigger value="page" className="min-h-11 text-xs sm:text-sm">
            {t("index.tabs.page")}
          </TabsTrigger>
          <TabsTrigger
            value="bookmarks"
            className="min-h-11 text-xs sm:text-sm"
          >
            {t("index.tabs.bookmarks")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="surah" className="mt-4 space-y-2">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("loading")}
            </p>
          ) : null}
          {!loading && filteredSurahs.length === 0 ? (
            <EmptyState title={t("navigation.noSurahs")} className="py-8" />
          ) : null}
          {filteredSurahs.map(({ name, number }) => (
            <ListRow
              key={number}
              className="justify-between py-2"
              onClick={() => handleSurahSelect(number)}
            >
              <span dir={language === "ar" ? "rtl" : "ltr"} lang={language}>
                <bdi>{formatNumber(number, locale)}</bdi>.{" "}
                {highlightSearchMatch(name, search)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("metadata.ayahCount", {
                  count: getSurahAyahCount(mushafData, number),
                  formattedCount: formatNumber(
                    getSurahAyahCount(mushafData, number),
                    locale,
                  ),
                })}
              </span>
            </ListRow>
          ))}
        </TabsContent>

        <TabsContent value="juz" className="mt-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {filteredJuz.map(({ name, juz }) => (
              <button
                key={juz}
                type="button"
                className="min-h-11 rounded-lg border px-2 py-2 text-start text-xs transition-colors hover:bg-muted"
                onClick={() => handleJuzSelect(juz)}
              >
                <span className="block font-semibold">
                  {formatNumber(juz, locale)}
                </span>
                <span
                  className="line-clamp-2 text-muted-foreground"
                  dir="rtl"
                  lang="ar"
                >
                  {highlightSearchMatch(name, search)}
                </span>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="page" className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              inputMode="numeric"
              aria-label={t("navigation.pageNumber")}
              placeholder={t("navigation.pageNumber")}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value)}
              className="min-h-11"
            />
            <Button type="button" onClick={() => handlePageGo()}>
              {t("navigation.goToPage")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("listenDialog.totalPages", {
              count: TOTAL_MUSHAF_PAGES,
              formattedCount: formatNumber(TOTAL_MUSHAF_PAGES, locale),
            })}
          </p>
          {search ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handlePageGo(search)}
            >
              {t("index.openPageSearch", { query: search })}
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="bookmarks" className="mt-4 space-y-2">
          {bookmarkEntries.length === 0 ? (
            <EmptyState
              title={t("index.noBookmarks")}
              action={
                <Button asChild variant="link">
                  <Link to={buildQuranReaderPath(1)}>
                    {t("index.openReader")}
                  </Link>
                </Button>
              }
            />
          ) : (
            bookmarkEntries.map((entry) => (
              <ListRow
                key={entry.verseKey}
                className="block rounded-lg border border-border px-3 py-2.5"
                onClick={() => handleAyahSelect(entry.surah, entry.ayah)}
              >
                <span className="block w-full">
                  <p className="text-sm font-medium">
                    {highlightSearchMatch(
                      t("index.bookmarkMeta", {
                        surahName: surahName(entry.surah),
                        ayah: formatNumber(entry.ayah, locale),
                      }),
                      search,
                    )}
                  </p>
                  {entry.text ? (
                    <p
                      dir="rtl"
                      lang="ar"
                      className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground"
                    >
                      {highlightSearchMatch(entry.text, search)}
                    </p>
                  ) : null}
                </span>
              </ListRow>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
