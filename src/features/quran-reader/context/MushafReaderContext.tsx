import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MushafLayoutMode } from "@/features/quran-reader/lib/quranReaderRoutes";

export type { MushafLayoutMode };

export interface MushafReaderHeaderState {
  tajweedColored: boolean;
  legendPinned: boolean;
  layoutMode: MushafLayoutMode;
  practiceActive: boolean;
  practiceLoading: boolean;
  onTajweedColoredChange: (value: boolean) => void;
  onLegendPinnedChange: (pinned: boolean) => void;
  onLayoutModeChange: (mode: MushafLayoutMode) => void;
  onOpenLegendGuide: () => void;
  onOpenSurahDrawer: () => void;
  onOpenAyahSearch: () => void;
  onOpenListenOptions: () => void;
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
