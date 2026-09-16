import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MushafVerse } from "@/domain/quran";
import type { MushafLayoutMode } from "@/features/quran-reader/model/quranReaderRoutes";

export interface MushafReaderHeaderState {
  /** Surah names on the visible page, already joined for the interface language. */
  surahLabel: string;
  page: number;
  /**
   * Page or surah. It decides how the reader is moved through - a page turns
   * on a swipe, a surah scrolls - so the header states it rather than leaving
   * it buried in the preferences sheet.
   */
  layoutMode: MushafLayoutMode;
  /** Zero-based index of the surah being read, for the wide-screen rail. */
  currentSurah: number | null;
  /**
   * The rail renders in the shell, which is above QuranDataProvider, so the
   * data comes with the rest of the reader's state rather than from a hook.
   */
  mushafData: MushafVerse[];
  practiceActive: boolean;
  practiceLoading: boolean;
  onLayoutModeChange: (mode: MushafLayoutMode) => void;
  onSurahSelect: (surahIndex: number) => void;
  onOpenSurahDrawer: () => void;
  onOpenAyahSearch: () => void;
  onOpenListenOptions: () => void;
  onOpenReadingPreferences: () => void;
  onTogglePractice: () => void;
}

interface MushafReaderContextValue {
  header: MushafReaderHeaderState | null;
  setHeader: (header: MushafReaderHeaderState | null) => void;
}

const MushafReaderContext = createContext<MushafReaderContextValue | null>(
  null,
);

export function MushafReaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<MushafReaderHeaderState | null>(null);
  const value = useMemo(() => ({ header, setHeader }), [header]);

  return (
    <MushafReaderContext.Provider value={value}>
      {children}
    </MushafReaderContext.Provider>
  );
}

export function useMushafReader() {
  const context = useContext(MushafReaderContext);
  if (!context) {
    throw new Error("useMushafReader must be used within MushafReaderProvider");
  }
  return context;
}
