import { useLocation, useNavigate } from "react-router-dom";
import {
  useQuranPlaybackActions,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import {
  buildQuranAyahPath,
  isQuranReaderPath,
} from "@/features/quran-reader/model/quranReaderRoutes";

/**
 * Jumps to the ayah being recited. Inside the reader the registered navigator
 * moves the page; elsewhere it opens the reader, which then consumes the
 * pending verse as soon as it registers its navigator.
 */
export function useGoToPlayingVerse(): () => void {
  const playback = useQuranPlaybackState();
  const actions = useQuranPlaybackActions();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return () => {
    const verseKey = playback.activeVerseKey;
    if (!verseKey) return;

    actions.setAutoFollowPages(true);
    actions.goToVerse(verseKey);
    if (isQuranReaderPath(pathname)) return;

    const [surah, ayah] = verseKey.split(":");
    if (!surah || !ayah) return;
    void navigate(
      buildQuranAyahPath(Number.parseInt(surah, 10), Number.parseInt(ayah, 10)),
    );
  };
}
