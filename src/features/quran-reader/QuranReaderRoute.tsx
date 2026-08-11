import { useEffect, useRef, type ReactNode } from "react";
import { Outlet, useParams } from "react-router-dom";
import { QuranDataProvider, useQuranData } from "@/domain/quran";
import { QuranPlaybackProvider } from "@/features/quran-reader/context/QuranPlaybackContext";
import { RecitationPracticeProvider } from "@practice/runtime";

function ReaderLayoutLoader({ children }: { children: ReactNode }) {
  const { pageNumber, surahNumber } = useParams<{
    pageNumber?: string;
    surahNumber?: string;
  }>();
  const { loadPageLayout, loadSurahLayouts } = useQuranData();
  const requestedLayouts = useRef(new Set<string>());

  useEffect(() => {
    const page = pageNumber ? Number.parseInt(pageNumber, 10) : null;
    const surah = surahNumber ? Number.parseInt(surahNumber, 10) : null;
    const key = page ? `page:${page}` : surah ? `surah:${surah}` : null;
    if (!key || requestedLayouts.current.has(key)) return;
    requestedLayouts.current.add(key);

    const request = page ? loadPageLayout(page) : loadSurahLayouts(surah ?? 1);
    void request.catch(() => requestedLayouts.current.delete(key));
  }, [loadPageLayout, loadSurahLayouts, pageNumber, surahNumber]);

  return children;
}

export function QuranReaderRoute() {
  return (
    <QuranDataProvider>
      <ReaderLayoutLoader>
        <QuranPlaybackProvider>
          <RecitationPracticeProvider>
            <Outlet />
          </RecitationPracticeProvider>
        </QuranPlaybackProvider>
      </ReaderLayoutLoader>
    </QuranDataProvider>
  );
}
