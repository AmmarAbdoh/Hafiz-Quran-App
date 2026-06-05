import { useEffect, useState } from "react";
import { loadMushafWordLayout } from "@/shared/services/quran-data";
import type { MushafWordLayoutData } from "@/shared/types/quran";

export function useMushafWordLayout() {
  const [data, setData] = useState<MushafWordLayoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadMushafWordLayout()
      .then((layout) => {
        if (!cancelled) {
          setData(layout);
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
