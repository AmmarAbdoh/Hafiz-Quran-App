import { useCallback, useState } from "react";
import { safeStorage } from "@/shared/storage";

const TAJWEED_STORAGE_KEY = "mushaf-tajweed-colored";
const FOOTER_PINNED_STORAGE_KEY = "mushaf-footer-pinned";

function readBooleanPreference(key: string): boolean {
  return safeStorage.getItem(key) === "true";
}

export function useReaderPreferences() {
  const [tajweedColored, setTajweedColored] = useState(() =>
    readBooleanPreference(TAJWEED_STORAGE_KEY),
  );
  const [legendPinned, setLegendPinned] = useState(false);
  const [footerPinned, setFooterPinned] = useState(() =>
    readBooleanPreference(FOOTER_PINNED_STORAGE_KEY),
  );

  // These actions are installed in the reader header context, so their
  // identity must remain stable while unrelated reader state changes.
  const changeTajweedColored = useCallback((value: boolean) => {
    setTajweedColored(value);
    safeStorage.setItem(TAJWEED_STORAGE_KEY, String(value));
    if (!value) setLegendPinned(false);
  }, []);

  const changeLegendPinned = useCallback((pinned: boolean) => {
    setLegendPinned(pinned);
  }, []);

  const changeFooterPinned = (pinned: boolean) => {
    setFooterPinned(pinned);
    safeStorage.setItem(FOOTER_PINNED_STORAGE_KEY, String(pinned));
  };

  return {
    tajweedColored,
    legendPinned,
    footerPinned,
    changeTajweedColored,
    changeLegendPinned,
    changeFooterPinned,
  };
}
