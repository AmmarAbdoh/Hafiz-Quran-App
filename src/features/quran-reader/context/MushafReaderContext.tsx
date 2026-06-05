import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface MushafReaderHeaderState {
  surahName: string;
  tajweedColored: boolean;
  legendOpen: boolean;
  onTajweedColoredChange: (value: boolean) => void;
  onLegendToggle: () => void;
  onOpenLegendGuide: () => void;
  onOpenSurahDrawer: () => void;
  onOpenAyahSearch: () => void;
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
