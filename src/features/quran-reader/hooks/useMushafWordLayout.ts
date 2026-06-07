import { useQuranData } from "@/features/quran-reader/context/QuranDataContext";

export function useMushafWordLayout() {
  const { wordLayout, loading, error } = useQuranData();
  return { data: wordLayout, loading, error };
}
