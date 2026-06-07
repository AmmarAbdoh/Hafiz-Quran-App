import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { preloadInitialQcfFonts } from "@/features/quran-reader/hooks/useQcfPageFont";
import {
  loadMushafData,
  loadMushafWordLayout,
  loadVerseInfoRecords,
  preloadQuranReaderData,
} from "@/shared/services/quran-data";
import type {
  MushafVerse,
  MushafWordLayoutData,
  VerseInfoRecord,
} from "@/shared/types/quran";

interface QuranDataContextValue {
  mushafData: MushafVerse[];
  wordLayout: MushafWordLayoutData | null;
  verseInfoRecords: VerseInfoRecord[];
  loading: boolean;
  error: string | null;
}

const QuranDataContext = createContext<QuranDataContextValue | null>(null);

void preloadQuranReaderData();
void preloadInitialQcfFonts();

export function QuranDataProvider({ children }: { children: ReactNode }) {
  const [mushafData, setMushafData] = useState<MushafVerse[]>([]);
  const [wordLayout, setWordLayout] =
    useState<MushafWordLayoutData | null>(null);
  const [verseInfoRecords, setVerseInfoRecords] = useState<VerseInfoRecord[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      loadMushafData(),
      loadMushafWordLayout(),
      loadVerseInfoRecords(),
    ])
      .then(([mushaf, layout, verseInfo]) => {
        if (cancelled) return;
        setMushafData(mushaf);
        setWordLayout(layout);
        setVerseInfoRecords(verseInfo);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      mushafData,
      wordLayout,
      verseInfoRecords,
      loading,
      error,
    }),
    [mushafData, wordLayout, verseInfoRecords, loading, error],
  );

  return (
    <QuranDataContext.Provider value={value}>
      {children}
    </QuranDataContext.Provider>
  );
}

export function useQuranData(): QuranDataContextValue {
  const context = useContext(QuranDataContext);
  if (!context) {
    throw new Error("useQuranData must be used within QuranDataProvider");
  }
  return context;
}
