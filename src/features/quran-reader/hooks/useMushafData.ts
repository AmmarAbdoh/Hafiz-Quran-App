import { useQuranData } from "@/features/quran-reader/context/QuranDataContext";

export function useMushafData() {
  const { mushafData, loading, error } = useQuranData();
  return { data: mushafData, loading, error };
}
