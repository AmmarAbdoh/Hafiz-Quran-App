import { useCallback, useEffect, useRef, useState } from "react";

import { AyahSearchDialog } from "@/features/quran-reader/components/AyahSearchDialog";

import { MushafAudioBar } from "@/features/quran-reader/components/MushafAudioBar";
import { MushafFooter } from "@/features/quran-reader/components/MushafFooter";

import { MushafViewer } from "@/features/quran-reader/components/MushafViewer";

import { SurahDrawer } from "@/features/quran-reader/components/SurahDrawer";

import { TajweedLegendDialog } from "@/features/quran-reader/components/TajweedLegendDialog";

import { useMushafReader } from "@/features/quran-reader/context/MushafReaderContext";
import { useQuranPlayback } from "@/features/quran-reader/context/QuranPlaybackContext";
import { findPageForVerse } from "@/features/quran-reader/utils/playbackUtils";

import { useMushafData } from "@/features/quran-reader/hooks/useMushafData";

import { useMushafWordLayout } from "@/features/quran-reader/hooks/useMushafWordLayout";

import { Skeleton } from "@/shared/components/ui/skeleton";

import {

  findMushafVerse,

  getFirstVerseOnPage,

  getSurahAyahCount,

  getVerseInfo,

  getWordLayoutTotalPages,

  loadVerseInfoRecords,

} from "@/shared/services/quran-data";



const TAJWEED_STORAGE_KEY = "mushaf-tajweed-colored";

const LEGEND_STORAGE_KEY = "mushaf-legend-open";

const HIGHLIGHT_DURATION_MS = 3500;



function readTajweedPreference(): boolean {

  return localStorage.getItem(TAJWEED_STORAGE_KEY) === "true";

}



function readLegendPreference(): boolean {

  return localStorage.getItem(LEGEND_STORAGE_KEY) === "true";

}



export function QuranReaderPage() {

  const { setHeader } = useMushafReader();
  const { registerPageNavigator } = useQuranPlayback();

  const { data: mushafData, loading: metaLoading, error: metaError } =

    useMushafData();

  const {

    data: wordLayout,

    loading: layoutLoading,

    error: layoutError,

  } = useMushafWordLayout();

  const [currentPage, setCurrentPage] = useState(1);

  const [currentSurah, setCurrentSurah] = useState<number | null>(null);

  const [surahDrawerOpen, setSurahDrawerOpen] = useState(false);

  const [ayahSearchOpen, setAyahSearchOpen] = useState(false);

  const [legendOpen, setLegendOpen] = useState(readLegendPreference);

  const [legendGuideOpen, setLegendGuideOpen] = useState(false);

  const [tajweedColored, setTajweedColored] = useState(readTajweedPreference);

  const [surahName, setSurahName] = useState("");

  const [surahNumber, setSurahNumber] = useState<number | undefined>();

  const [surahAyahCount, setSurahAyahCount] = useState<number | undefined>();

  const [juzNumber, setJuzNumber] = useState<number | string | undefined>();

  const [hizbNumber, setHizbNumber] = useState<number | string | undefined>();

  const [highlightVerseKey, setHighlightVerseKey] = useState<string | null>(

    null,

  );

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);



  const loading = metaLoading || layoutLoading;

  const error = metaError ?? layoutError;

  const totalPages = wordLayout ? getWordLayoutTotalPages(wordLayout) : 604;



  const clearHighlightTimer = useCallback(() => {

    if (highlightTimerRef.current) {

      clearTimeout(highlightTimerRef.current);

      highlightTimerRef.current = null;

    }

  }, []);



  const flashVerseHighlight = useCallback(

    (verseKey: string) => {

      clearHighlightTimer();

      setHighlightVerseKey(verseKey);

      highlightTimerRef.current = setTimeout(() => {

        setHighlightVerseKey(null);

        highlightTimerRef.current = null;

      }, HIGHLIGHT_DURATION_MS);

    },

    [clearHighlightTimer],

  );



  const handlePageChange = useCallback(

    (page: number) => {

      if (page >= 1 && page <= totalPages) {

        clearHighlightTimer();

        setHighlightVerseKey(null);

        setCurrentPage(page);

        setCurrentSurah(null);

      }

    },

    [totalPages, clearHighlightTimer],

  );



  const handleSurahSelect = useCallback(

    (surahIndex: number) => {

      const firstVerse = mushafData.find(

        (verse) => verse.sura_no === surahIndex + 1,

      );

      if (firstVerse) {

        clearHighlightTimer();

        setHighlightVerseKey(null);

        setCurrentSurah(surahIndex);

        setCurrentPage(firstVerse.page);

        setSurahDrawerOpen(false);

      }

    },

    [mushafData, clearHighlightTimer],

  );



  const handleAyahSelect = useCallback(

    (surah: number, ayah: number) => {

      const verse = findMushafVerse(mushafData, surah, ayah);

      if (!verse) return;



      const verseKey = `${surah}:${ayah}`;

      setCurrentSurah(surah - 1);

      setCurrentPage(verse.page);

      flashVerseHighlight(verseKey);

    },

    [mushafData, flashVerseHighlight],

  );



  const handleTajweedColoredChange = useCallback((value: boolean) => {

    setTajweedColored(value);

    localStorage.setItem(TAJWEED_STORAGE_KEY, String(value));

    if (!value) setLegendOpen(false);

  }, []);



  const handleLegendToggle = useCallback(() => {

    setLegendOpen((prev) => {

      const next = !prev;

      localStorage.setItem(LEGEND_STORAGE_KEY, String(next));

      return next;

    });

  }, []);



  const handleOpenSurahDrawer = useCallback(() => {

    setSurahDrawerOpen(true);

  }, []);



  const handleOpenLegendGuide = useCallback(() => {

    setLegendGuideOpen(true);

  }, []);



  const handleOpenAyahSearch = useCallback(() => {

    setAyahSearchOpen(true);

  }, []);



  useEffect(() => {

    const firstVerse = getFirstVerseOnPage(mushafData, currentPage);

    if (!firstVerse) return;



    setSurahName(firstVerse.sura_name_ar);

    setSurahNumber(firstVerse.sura_no);

    setSurahAyahCount(getSurahAyahCount(mushafData, firstVerse.sura_no));

    loadVerseInfoRecords().then((records) => {

      const info = getVerseInfo(firstVerse.id, records);

      setJuzNumber(info.find((item) => item.key === "رقم الجزء")?.value);

      setHizbNumber(info.find((item) => item.key === "رقم الحزب")?.value);

    });

  }, [currentPage, mushafData]);



  useEffect(() => {

    if (loading || error) {

      setHeader(null);

      return;

    }



    setHeader({

      surahName,

      tajweedColored,

      legendOpen,

      onTajweedColoredChange: handleTajweedColoredChange,

      onLegendToggle: handleLegendToggle,

      onOpenLegendGuide: handleOpenLegendGuide,

      onOpenSurahDrawer: handleOpenSurahDrawer,

      onOpenAyahSearch: handleOpenAyahSearch,

    });



    return () => setHeader(null);

  }, [

    loading,

    error,

    surahName,

    tajweedColored,

    legendOpen,

    handleTajweedColoredChange,

    handleLegendToggle,

    handleOpenLegendGuide,

    handleOpenSurahDrawer,

    handleOpenAyahSearch,

    setHeader,

  ]);



  useEffect(() => {
    if (!wordLayout) return;

    registerPageNavigator((verseKey) => {
      const page = findPageForVerse(wordLayout, verseKey);
      if (page) {
        setCurrentPage(page);
      }
    });
  }, [wordLayout, registerPageNavigator]);

  useEffect(() => () => clearHighlightTimer(), [clearHighlightTimer]);



  if (loading) {

    return (

      <div className="flex min-h-[50vh] items-center justify-center px-4">

        <Skeleton className="h-[30vh] w-full max-w-3xl" />

      </div>

    );

  }



  if (error) {

    return (

      <div className="flex min-h-[50vh] items-center justify-center px-4">

        <p className="text-center text-destructive">

          تعذر تحميل بيانات المصحف: {error}

        </p>

      </div>

    );

  }



  return (

    <div className="mushaf-reader-layout">

      <div className="mushaf-stage">

        <div className="mushaf-stage-inner">

          {wordLayout && (

            <MushafViewer

              mushafData={mushafData}

              wordLayout={wordLayout}

              currentPage={currentPage}

              tajweedColored={tajweedColored}

              highlightVerseKey={highlightVerseKey}

            />

          )}

        </div>

      </div>



      <div className="mushaf-bottom-chrome">
        <MushafAudioBar />

        <MushafFooter

          currentPage={currentPage}

          totalPages={totalPages}

          onPageChange={handlePageChange}

          surahNumber={surahNumber}

          surahAyahCount={surahAyahCount}

          juzNumber={juzNumber}

          hizbNumber={hizbNumber}

        />
      </div>



      <TajweedLegendDialog

        open={legendGuideOpen}

        onOpenChange={setLegendGuideOpen}

      />



      <AyahSearchDialog

        open={ayahSearchOpen}

        onOpenChange={setAyahSearchOpen}

        mushafData={mushafData}

        onAyahSelect={handleAyahSelect}

      />



      <SurahDrawer

        open={surahDrawerOpen}

        onOpenChange={setSurahDrawerOpen}

        mushafData={mushafData}

        currentSurah={currentSurah}

        onSurahSelect={handleSurahSelect}

      />

    </div>

  );

}

