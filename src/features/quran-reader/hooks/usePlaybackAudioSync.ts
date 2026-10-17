import { useCallback, useRef, useState, type RefObject } from "react";
import { findActiveWordLocation, type WordSegment } from "@/domain/quran";
import {
  computeSessionTime,
  emptyPlaybackTime,
  type PlaybackTime,
} from "@/features/quran-reader/model/playbackTime";
import type { SurahTimestamp } from "@/domain/quran";

/** What the session must expose for the clock to place itself inside it. */
interface PlaybackSessionTiming {
  playlist: ReadonlyArray<{ surah: number; ayah: number }>;
  index: number;
  surahTimestampsCache: Map<number, SurahTimestamp[]>;
}

interface Options {
  /** Word timings for the ayah sounding now. */
  segmentsRef: RefObject<WordSegment[]>;
  sessionRef: RefObject<PlaybackSessionTiming>;
}

/**
 * Everything that watches one `<audio>` element while it plays.
 *
 * The word highlight, the clock and the object URL of downloaded audio all
 * live on the same lifecycle - they start when an element starts and must all
 * be let go before the next one begins - and none of them has anything to do
 * with playlists, repeat counts or scopes. Keeping them beside that logic had
 * the provider at 707 lines doing five jobs.
 *
 * Both published values are separate React state on purpose: they change
 * every frame and every second, and the reader is thousands of glyph spans
 * that must not re-render for either.
 */
export function usePlaybackAudioSync({ segmentsRef, sessionRef }: Options) {
  const [activeWordLocation, setActiveWordLocation] = useState<string | null>(
    null,
  );
  const [playbackTime, setPlaybackTime] =
    useState<PlaybackTime>(emptyPlaybackTime);

  const publishedWordRef = useRef<string | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const timeListenerRef = useRef<(() => void) | null>(null);
  const publishedSecondRef = useRef(-1);
  const blobUrlRef = useRef<string | null>(null);

  const publishActiveWord = useCallback((location: string | null) => {
    if (publishedWordRef.current === location) return;
    publishedWordRef.current = location;
    setActiveWordLocation(location);
  }, []);

  const stopWordSync = useCallback(() => {
    if (syncFrameRef.current === null) return;
    cancelAnimationFrame(syncFrameRef.current);
    syncFrameRef.current = null;
  }, []);

  /**
   * Follows the word being recited, one animation frame at a time.
   *
   * `isCurrent` lets the caller abandon the loop when the operation that
   * started it has been superseded, without this hook knowing what an
   * operation is.
   */
  const startWordSync = useCallback(
    (
      audio: HTMLAudioElement,
      { isCurrent }: { isCurrent: () => boolean },
      supportsWordHighlight: boolean,
    ) => {
      stopWordSync();
      if (!supportsWordHighlight) {
        publishActiveWord(null);
        return;
      }

      const sync = () => {
        if (!isCurrent()) return;

        publishActiveWord(
          findActiveWordLocation(
            segmentsRef.current ?? [],
            audio.currentTime * 1000,
          ),
        );

        if (!audio.paused && !audio.ended) {
          syncFrameRef.current = requestAnimationFrame(sync);
        }
      };

      syncFrameRef.current = requestAnimationFrame(sync);
    },
    [publishActiveWord, segmentsRef, stopWordSync],
  );

  const stopTimeSync = useCallback(() => {
    timeListenerRef.current?.();
    timeListenerRef.current = null;
    publishedSecondRef.current = -1;
  }, []);

  /*
   * timeupdate fires about four times a second; a clock reading m:ss only
   * changes once. Publishing on the whole second keeps this to one render per
   * second instead of four.
   */
  const startTimeSync = useCallback(
    (audio: HTMLAudioElement) => {
      timeListenerRef.current?.();
      publishedSecondRef.current = -1;

      const publish = () => {
        const ayahMs = audio.currentTime * 1000;
        const second = Math.floor(ayahMs / 1000);
        const durationMs = Number.isFinite(audio.duration)
          ? audio.duration * 1000
          : 0;
        if (second === publishedSecondRef.current) return;
        publishedSecondRef.current = second;

        const session = sessionRef.current;
        setPlaybackTime({
          ayahMs,
          ayahDurationMs: durationMs,
          ...(session
            ? computeSessionTime({
                playlist: session.playlist,
                index: session.index,
                ayahMs,
                timestamps: session.surahTimestampsCache,
              })
            : { sessionMs: null, sessionTotalMs: null }),
        });
      };

      audio.addEventListener("timeupdate", publish);
      audio.addEventListener("loadedmetadata", publish);
      publish();

      timeListenerRef.current = () => {
        audio.removeEventListener("timeupdate", publish);
        audio.removeEventListener("loadedmetadata", publish);
      };
    },
    [sessionRef],
  );

  /** Takes ownership of an object URL for audio served from the download cache. */
  const holdBlobUrl = useCallback((url: string) => {
    blobUrlRef.current = url;
  }, []);

  const releaseBlobUrl = useCallback(() => {
    if (!blobUrlRef.current) return;
    URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
  }, []);

  /** Lets go of everything watching the element that is finishing. */
  const stopAll = useCallback(() => {
    stopWordSync();
    stopTimeSync();
  }, [stopTimeSync, stopWordSync]);

  const resetPublished = useCallback(() => {
    publishActiveWord(null);
    setPlaybackTime(emptyPlaybackTime);
  }, [publishActiveWord]);

  return {
    activeWordLocation,
    playbackTime,
    publishActiveWord,
    startWordSync,
    startTimeSync,
    holdBlobUrl,
    releaseBlobUrl,
    stopAll,
    resetPublished,
  };
}
