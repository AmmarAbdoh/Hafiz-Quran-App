import { useEffect } from "react";
import {
  useQuranPlaybackHighlight,
  useQuranPlaybackState,
} from "@/features/quran-reader/context/QuranPlaybackContext";
import {
  isComfortablyVisible,
  scrollTopForVerse,
} from "@/features/quran-reader/model/followScroll";
import {
  maxScrollTopOf,
  measureVerse,
  measureWord,
  readStageGeometry,
} from "@/features/quran-reader/model/verseGeometry";

/**
 * Frames to wait for the recited ayah to be laid out after a page turn: the
 * new page's layout and font arrive a moment after the route changes. About
 * a second, after which there is nothing to follow.
 */
const FRAMES_TO_WAIT_FOR_LAYOUT = 60;

/**
 * Keep what is being recited in view.
 *
 * A page that fits its screen never needed this, and page view did nothing:
 * it turned pages and no more. With the text made larger the page scrolls,
 * and the recitation walked off the bottom of it - and after a page turn the
 * new page opened wherever the last one had been left. So it follows the word
 * being recited, or the ayah when there is no word timing, in both views. It
 * moves only once that has left comfortable view, and puts it a third of the
 * way down, so the page does not shift under the reader at every word.
 *
 * A component rather than a hook in the reader: the word changes several
 * times a second, and the reader is thousands of glyph spans that must not
 * re-render for it. This renders nothing.
 */
export function PlaybackScrollFollower({ page }: { page: number }) {
  const { active, activeVerseKey, autoFollowPages } = useQuranPlaybackState();
  const { activeWordLocation } = useQuranPlaybackHighlight();

  useEffect(() => {
    if (!active || !autoFollowPages || !activeVerseKey) return;

    let frame = 0;
    let waited = 0;
    const follow = () => {
      const geometry = readStageGeometry();
      const target =
        geometry &&
        ((activeWordLocation &&
          measureWord(geometry.stage, activeWordLocation)) ??
          measureVerse(geometry.stage, activeVerseKey));
      if (!geometry || !target) {
        waited += 1;
        if (waited < FRAMES_TO_WAIT_FOR_LAYOUT) {
          frame = requestAnimationFrame(follow);
        }
        return;
      }

      const { stage, box, bottomInset } = geometry;
      if (isComfortablyVisible(target, box, bottomInset)) return;
      stage.scrollTo({
        top: scrollTopForVerse(
          target,
          box,
          stage.scrollTop,
          maxScrollTopOf(stage),
          bottomInset,
        ),
        behavior: "smooth",
      });
    };

    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [active, activeVerseKey, activeWordLocation, autoFollowPages, page]);

  return null;
}
