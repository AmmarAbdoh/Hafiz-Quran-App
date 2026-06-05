import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  DEFAULT_RECITER_ID,
  getReciterById,
  type ReciterOption,
} from "@/shared/constants/reciters";

const STORAGE_KEY = "quran-reciter-id";

interface ReciterContextValue {
  reciter: ReciterOption;
  setReciterId: (id: string) => void;
}

const ReciterContext = createContext<ReciterContextValue | null>(null);

export function ReciterProvider({ children }: { children: React.ReactNode }) {
  const [reciterId, setReciterIdState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const initial = stored ?? DEFAULT_RECITER_ID;
    return getReciterById(initial).id;
  });

  const reciter = getReciterById(reciterId);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, reciterId);
  }, [reciterId]);

  const setReciterId = useCallback((id: string) => {
    setReciterIdState(id);
  }, []);

  return (
    <ReciterContext.Provider value={{ reciter, setReciterId }}>
      {children}
    </ReciterContext.Provider>
  );
}

export function useReciter() {
  const context = useContext(ReciterContext);
  if (!context) {
    throw new Error("useReciter must be used within ReciterProvider");
  }
  return context;
}
