import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  QuranRepositoryError,
  quranRepository,
  type MushafPageLayout,
  type MushafVerse,
  type VerseInfoRecord,
} from "@/domain/quran/data";

export interface QuranDataContextValue {
  mushafData: MushafVerse[];
  loadedPageLayouts: MushafPageLayout[];
  verseInfoRecords: VerseInfoRecord[];
  loading: boolean;
  layoutLoading: boolean;
  error: string | null;
  errorRetryable: boolean;
  loadPageLayout: (page: number) => Promise<MushafPageLayout>;
  loadSurahLayouts: (surah: number) => Promise<MushafPageLayout[]>;
  retryCoreData: () => void;
  clearError: () => void;
}

const QuranDataContext = createContext<QuranDataContextValue | null>(null);

function mergeLayouts(
  current: Map<number, MushafPageLayout>,
  layouts: MushafPageLayout[],
) {
  const next = new Map(current);
  let changed = false;
  for (const layout of layouts) {
    if (next.get(layout.page) !== layout) {
      next.set(layout.page, layout);
      changed = true;
    }
  }
  return changed ? next : current;
}

export function QuranDataProvider({ children }: { children: ReactNode }) {
  const { t: tErrors, i18n } = useTranslation("errors");
  const [mushafData, setMushafData] = useState<MushafVerse[]>([]);
  const [verseInfoRecords, setVerseInfoRecords] = useState<VerseInfoRecord[]>(
    [],
  );
  const [pages, setPages] = useState(() => new Map<number, MushafPageLayout>());
  const [loading, setLoading] = useState(true);
  const [pendingLayouts, setPendingLayouts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [coreRequestVersion, setCoreRequestVersion] = useState(0);

  const reportError = useCallback(
    (cause: unknown) => {
      if (cause instanceof QuranRepositoryError) {
        const locale = i18n.resolvedLanguage?.startsWith("en") ? "en" : "ar";
        setError(cause.getLocalizedMessage(locale));
        setErrorRetryable(cause.retryable);
        return;
      }
      setError(tErrors("quranLoad"));
      setErrorRetryable(true);
    },
    [i18n.resolvedLanguage, tErrors],
  );

  const retryCoreData = useCallback(
    () => setCoreRequestVersion((version) => version + 1),
    [],
  );
  const clearError = useCallback(() => {
    setError(null);
    setErrorRetryable(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    quranRepository
      .loadCoreData()
      .then((core) => {
        if (cancelled) return;
        setMushafData(core.mushafVerses);
        setVerseInfoRecords(core.verseInfo);
      })
      .catch((cause: unknown) => {
        if (!cancelled) reportError(cause);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [coreRequestVersion, reportError]);

  const runLayoutRequest = useCallback(
    async <T,>(request: () => Promise<T>): Promise<T> => {
      setPendingLayouts((count) => count + 1);
      setError(null);
      try {
        return await request();
      } catch (cause) {
        reportError(cause);
        throw cause;
      } finally {
        setPendingLayouts((count) => Math.max(0, count - 1));
      }
    },
    [reportError],
  );

  const loadPageLayout = useCallback(
    (page: number) =>
      runLayoutRequest(async () => {
        const layout = await quranRepository.loadPageLayout(page);
        setPages((current) => mergeLayouts(current, [layout]));
        return layout;
      }),
    [runLayoutRequest],
  );

  const loadSurahLayouts = useCallback(
    (surah: number) =>
      runLayoutRequest(async () => {
        const layouts = await quranRepository.loadSurahLayouts(surah);
        setPages((current) => mergeLayouts(current, layouts));
        return layouts;
      }),
    [runLayoutRequest],
  );

  const loadedPageLayouts = useMemo(
    () => [...pages.values()].sort((left, right) => left.page - right.page),
    [pages],
  );

  const value = useMemo<QuranDataContextValue>(
    () => ({
      mushafData,
      loadedPageLayouts,
      verseInfoRecords,
      loading,
      layoutLoading: pendingLayouts > 0,
      error,
      errorRetryable,
      loadPageLayout,
      loadSurahLayouts,
      retryCoreData,
      clearError,
    }),
    [
      error,
      errorRetryable,
      loadPageLayout,
      loadSurahLayouts,
      loading,
      mushafData,
      pendingLayouts,
      clearError,
      retryCoreData,
      verseInfoRecords,
      loadedPageLayouts,
    ],
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
