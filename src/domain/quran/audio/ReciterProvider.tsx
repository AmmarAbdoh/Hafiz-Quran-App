import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_RECITER_ID,
  getReciterById,
  type ReciterOption,
} from "./reciters";
import { safeStorage, STORAGE_KEYS } from "@/shared/storage";

interface ReciterContextValue {
  reciter: ReciterOption;
  setReciterId: (id: string) => void;
}

const ReciterContext = createContext<ReciterContextValue | null>(null);

export function ReciterProvider({ children }: { children: React.ReactNode }) {
  const [reciterId, setReciterIdState] = useState(() => {
    const stored = safeStorage.getItem(STORAGE_KEYS.reciter);
    const initial = stored ?? DEFAULT_RECITER_ID;
    return getReciterById(initial).id;
  });

  const reciter = getReciterById(reciterId);

  useEffect(() => {
    safeStorage.setItem(STORAGE_KEYS.reciter, reciterId);
  }, [reciterId]);

  const setReciterId = (id: string) => {
    setReciterIdState(getReciterById(id).id);
  };

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
