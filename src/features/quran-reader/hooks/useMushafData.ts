import { useEffect, useState } from "react";
import { loadMushafData } from "@/shared/services/quran-data";
import type { MushafVerse } from "@/shared/types/quran";

export function useMushafData() {
  const [data, setData] = useState<MushafVerse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadMushafData()
      .then((mushaf) => {
        if (!cancelled) {
          setData(mushaf);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
