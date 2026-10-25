import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  SURAH_AYAH_COUNTS,
  fetchSurahAudioMeta,
  fetchVerseAudioData,
  getAyahAudioUrl,
  getQuranComRecitationId,
  mergeWordSegments,
  useReciter,
  type SurahTimestamp,
  type WordSegment,
} from "@/domain/quran";
import type { BuiltListenSession } from "@/features/quran-reader/model/listenPlanTypes";
import { MediaOperationController } from "@/features/quran-reader/services/mediaOperationController";
import {
  initialQuranPlaybackState,
  quranPlaybackReducer,
  type QuranPlaybackState,
} from "@/features/quran-reader/model/playbackState";
import {
  playlistIndexAt,
  type PlaybackTime,
} from "@/features/quran-reader/model/playbackTime";
import { usePlaybackAudioSync } from "@/features/quran-reader/hooks/usePlaybackAudioSync";
import {
  cachedAudioUrl,
  hasCachedAudio,
} from "@/features/quran-reader/services/audioDownloads";
import { CancellableAudioPlayer } from "@/shared/media";
import { claimAudioFocus, releaseAudioFocus } from "@/shared/media/audioFocus";

export type { QuranPlaybackState } from "@/features/quran-reader/model/playbackState";

export interface QuranPlaybackHighlightState {
  activeWordLocation: string | null;
}

export type { PlaybackTime } from "@/features/quran-reader/model/playbackTime";

export interface QuranPlaybackActions {
  startListening: (session: BuiltListenSession) => Promise<void>;
  startAyahPlayback: (surah: number, ayah: number) => Promise<void>;
  /**
   * One ayah, on a loop. Repeating a single ayah until it sticks is the
   * memorization loop itself, and it used to require leaving the ayah,
   * opening a dialog and typing back the surah and ayah already selected.
   */
  startAyahRepeat: (
    surah: number,
    ayah: number,
    repeat: number | "infinite",
  ) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  registerPageNavigator: (
    navigator: ((verseKey: string) => void) | null,
  ) => void;
  goToVerse: (verseKey: string) => void;
  /**
   * Carry on from another ayah of the session: `index` into its playlist, or
   * a point along it from 0 to 1 - where the progress line was tapped. The
   * page turns to it, as it does when a recitation reaches a new page.
   */
  seekToItem: (index: number) => void;
  seekToFraction: (fraction: number) => void;
  setActiveVerseInView: (inView: boolean) => void;
  setAutoFollowPages: (follow: boolean) => void;
}

interface ListenSession {
  playlist: Array<{ surah: number; ayah: number }>;
  index: number;
  repeatMode: BuiltListenSession["repeatMode"];
  repeatCount: number;
  repeatEachAyah: boolean;
  blockRepeatDone: number;
  unitRepeatLeft: number;
  scopePlan: BuiltListenSession["plan"];
  quranComId: number | null;
  supportsWordHighlight: boolean;
  surahTimestampsCache: Map<number, SurahTimestamp[]>;
}

function createEmptySession(): ListenSession {
  return {
    playlist: [],
    index: 0,
    repeatMode: "none",
    repeatCount: 1,
    repeatEachAyah: false,
    blockRepeatDone: 0,
    unitRepeatLeft: 0,
    scopePlan: {
      scope: "surah",
      surah: 1,
      ayah: 1,
      repeatMode: "none",
      repeatCount: 1,
    },
    quranComId: null,
    supportsWordHighlight: false,
    surahTimestampsCache: new Map(),
  };
}

/** Where an ayah's recording is, and its word timings when it has them. */
interface ResolvedAyahAudio {
  audioUrl: string;
  segments: WordSegment[];
}

type Reciter = Parameters<typeof getAyahAudioUrl>[0];

const ayahKey = (item: { surah: number; ayah: number }) =>
  `${item.surah}:${item.ayah}`;

/**
 * Find an ayah's recording: Quran.com's, with word timings, for a reciter it
 * publishes them for, and the reciter's per-ayah file otherwise - or when the
 * lookup fails, which is what keeps a recitation going offline. Throws only
 * when `signal` was aborted.
 */
async function resolveAyahAudio(
  session: ListenSession,
  item: { surah: number; ayah: number },
  reciter: Reciter,
  signal: AbortSignal,
): Promise<ResolvedAyahAudio> {
  if (session.quranComId) {
    try {
      let timestamps = session.surahTimestampsCache.get(item.surah);
      if (!timestamps) {
        const metadata = await fetchSurahAudioMeta(
          item.surah,
          session.quranComId,
          signal,
        );
        timestamps = metadata?.ayahTimestamps ?? [];
        session.surahTimestampsCache.set(item.surah, timestamps);
      }

      const verseAudio = await fetchVerseAudioData(
        ayahKey(item),
        session.quranComId,
        signal,
      );
      if (verseAudio) {
        const chapterEntry = timestamps.find(
          (entry) => entry.ayah === item.ayah,
        );
        return {
          audioUrl: verseAudio.audioUrl,
          segments: chapterEntry
            ? mergeWordSegments(
                verseAudio.segments,
                chapterEntry.chapterSegments,
                verseAudio.wordsByPosition,
              )
            : verseAudio.segments,
        };
      }
    } catch (error) {
      if (signal.aborted) throw error;
    }
  }
  return {
    audioUrl: getAyahAudioUrl(reciter, item.surah, item.ayah),
    segments: [],
  };
}

function getRepeatIteration(session: ListenSession): number {
  if (session.repeatMode !== "count") return 1;
  if (session.repeatEachAyah) {
    return Math.max(1, session.repeatCount - session.unitRepeatLeft + 1);
  }
  return session.blockRepeatDone + 1;
}

const QuranPlaybackStateContext = createContext<QuranPlaybackState | null>(
  null,
);
const QuranPlaybackHighlightContext =
  createContext<QuranPlaybackHighlightState | null>(null);
/*
 * Its own context, like the highlight above it. The clock changes once a
 * second while a recitation runs, and the reader - thousands of glyph spans -
 * has no reason to re-render for it.
 */
const QuranPlaybackTimeContext = createContext<PlaybackTime | null>(null);
const QuranPlaybackActionsContext = createContext<QuranPlaybackActions | null>(
  null,
);

export function QuranPlaybackProvider({ children }: { children: ReactNode }) {
  const { reciter } = useReciter();
  const [state, dispatch] = useReducer(
    quranPlaybackReducer,
    initialQuranPlaybackState,
  );
  const audioPlayerRef = useRef<CancellableAudioPlayer | null>(null);
  if (!audioPlayerRef.current) {
    audioPlayerRef.current = new CancellableAudioPlayer();
  }
  const audioPlayer = audioPlayerRef.current;
  const audioOwnerRef = useRef({ stop: () => {} });
  const stopRef = useRef<() => void>(() => {});
  const pageNavigatorRef = useRef<((verseKey: string) => void) | null>(null);
  const pendingVerseKeyRef = useRef<string | null>(null);
  const segmentsRef = useRef<WordSegment[]>([]);
  const sessionRef = useRef<ListenSession>(createEmptySession());
  const stateRef = useRef(state);
  stateRef.current = state;
  const operationControllerRef = useRef<MediaOperationController | null>(null);
  if (!operationControllerRef.current) {
    operationControllerRef.current = new MediaOperationController();
  }
  /*
   * The next ayah, looked up while the current one plays; see `prefetchNext`.
   * Keyed by ayah, and aborted with the session rather than with the item:
   * the item's own operation ends at the very moment the next one starts,
   * which is when the lookup has to be there.
   */
  const upcomingRef = useRef(new Map<string, Promise<ResolvedAyahAudio>>());
  const upcomingAbortRef = useRef(new AbortController());

  const {
    activeWordLocation,
    playbackTime,
    publishActiveWord,
    startWordSync,
    startTimeSync,
    holdBlobUrl,
    releaseBlobUrl,
    stopAll: stopAudioSync,
    resetPublished,
  } = usePlaybackAudioSync({ segmentsRef, sessionRef });

  const cleanupAudio = useCallback(() => {
    stopAudioSync();
    audioPlayer.stop(false);
    // After the player has let go of the element, or the src is revoked from
    // under it mid-play.
    releaseBlobUrl();
  }, [audioPlayer, releaseBlobUrl, stopAudioSync]);

  const cancelCurrentSession = useCallback(() => {
    operationControllerRef.current?.cancel();
    upcomingAbortRef.current.abort();
    upcomingAbortRef.current = new AbortController();
    upcomingRef.current.clear();
    audioPlayer.clearPreload();
    cleanupAudio();
    segmentsRef.current = [];
    sessionRef.current = createEmptySession();
    resetPublished();
  }, [audioPlayer, cleanupAudio, resetPublished]);

  const stop = useCallback(() => {
    releaseAudioFocus(audioOwnerRef.current);
    cancelCurrentSession();
    dispatch({ type: "reset" });
  }, [cancelCurrentSession]);
  stopRef.current = stop;
  audioOwnerRef.current.stop = () => stopRef.current();

  const playAtIndexRef = useRef<(index: number) => Promise<void>>(() =>
    Promise.resolve(),
  );

  /**
   * Have the ayah after this one ready before this one ends.
   *
   * Its lookup and its audio are both fetched now, so the gap between ayat is
   * the recording's own pause and not a network wait. Only the next item in
   * the playlist: a repeated ayah replays a file the browser already holds,
   * and looking further ahead would spend data on ayat the reader may stop
   * before. A downloaded recording is local already and is left alone.
   */
  const prefetchNext = (session: ListenSession, index: number) => {
    const next = session.playlist[index + 1];
    if (!next || upcomingRef.current.has(ayahKey(next))) return;
    const signal = upcomingAbortRef.current.signal;
    const pending = resolveAyahAudio(session, next, reciter, signal);
    upcomingRef.current.set(ayahKey(next), pending);
    void pending.then(
      async ({ audioUrl }) => {
        if (signal.aborted || (await hasCachedAudio(audioUrl))) return;
        if (!signal.aborted) audioPlayer.preload(audioUrl);
      },
      () => {},
    );
  };
  const advanceAfterAyahRef = useRef<() => void>(() => undefined);

  advanceAfterAyahRef.current = () => {
    const session = sessionRef.current;
    if (!session.playlist[session.index]) {
      stop();
      return;
    }

    if (session.repeatEachAyah) {
      if (session.repeatMode === "infinite") {
        void playAtIndexRef.current(session.index);
        return;
      }
      if (session.repeatMode === "count" && session.unitRepeatLeft > 1) {
        session.unitRepeatLeft -= 1;
        void playAtIndexRef.current(session.index);
        return;
      }
    }

    if (session.index < session.playlist.length - 1) {
      session.index += 1;
      if (session.repeatEachAyah && session.repeatMode === "count") {
        session.unitRepeatLeft = session.repeatCount;
      }
      void playAtIndexRef.current(session.index);
      return;
    }

    if (session.repeatEachAyah) {
      stop();
      return;
    }

    if (session.repeatMode === "infinite") {
      session.index = 0;
      session.blockRepeatDone = 0;
      void playAtIndexRef.current(0);
      return;
    }

    if (
      session.repeatMode === "count" &&
      session.blockRepeatDone + 1 < session.repeatCount
    ) {
      session.blockRepeatDone += 1;
      session.index = 0;
      if (session.repeatEachAyah) {
        session.unitRepeatLeft = session.repeatCount;
      }
      void playAtIndexRef.current(0);
      return;
    }

    stop();
  };

  const presentCurrentItem = useCallback(() => {
    const session = sessionRef.current;
    const item = session.playlist[session.index];
    if (!item) return;

    publishActiveWord(null);
    dispatch({
      type: "item-ready",
      item: {
        surah: item.surah,
        ayah: item.ayah,
        reciterName: reciter.nameAr,
        supportsWordHighlight: session.supportsWordHighlight,
        scopePlan: session.scopePlan,
        playlistIndex: session.index + 1,
        playlistTotal: session.playlist.length,
        repeatMode: session.repeatMode,
        repeatCount: session.repeatCount,
        repeatEachAyah: session.repeatEachAyah,
        repeatIteration: getRepeatIteration(session),
      },
    });
  }, [publishActiveWord, reciter.nameAr]);

  playAtIndexRef.current = async (index: number) => {
    const session = sessionRef.current;
    const item = session.playlist[index];
    if (!item) {
      stop();
      return;
    }

    session.index = index;
    const controller = operationControllerRef.current!;
    const operation = controller.begin();
    claimAudioFocus(audioOwnerRef.current);
    cleanupAudio();
    segmentsRef.current = [];
    presentCurrentItem();

    /* Looked up already, if the last ayah had time to; see `prefetchNext`. */
    const upcoming = upcomingRef.current.get(ayahKey(item));
    upcomingRef.current.delete(ayahKey(item));
    let resolved: ResolvedAyahAudio;
    try {
      resolved = await (upcoming ??
        resolveAyahAudio(session, item, reciter, operation.signal));
    } catch {
      if (!controller.isCurrent(operation)) return;
      resolved = {
        audioUrl: getAyahAudioUrl(reciter, item.surah, item.ayah),
        segments: [],
      };
    }
    if (!controller.isCurrent(operation)) return;
    segmentsRef.current = resolved.segments;
    let audioUrl = resolved.audioUrl;

    /*
     * Downloaded recitation, when this is the file that was downloaded.
     *
     * Only the URL playback already settled on is looked up. A reciter with
     * published word timings streams from that source instead, and its
     * segment times belong to that recording - playing a different cut of
     * the same reciter against them would drift the word highlight. Offline
     * the timings cannot be fetched at all, the code above falls back to the
     * per-ayah URL, and that is the one the download cache holds.
     */
    const offlineUrl = await cachedAudioUrl(audioUrl);
    if (!controller.isCurrent(operation)) {
      if (offlineUrl) URL.revokeObjectURL(offlineUrl);
      return;
    }
    if (offlineUrl) {
      holdBlobUrl(offlineUrl);
      audioUrl = offlineUrl;
    }

    await audioPlayer.play(audioUrl, {
      signal: operation.signal,
      onPlaying: ({ audio }) => {
        if (!controller.isCurrent(operation)) return;
        dispatch({ type: "playback-changed", playing: true, error: null });
        startWordSync(
          audio,
          {
            isCurrent: () =>
              Boolean(operationControllerRef.current?.isCurrent(operation)) &&
              audioPlayer.currentAudio === audio,
          },
          session.supportsWordHighlight,
        );
        startTimeSync(audio);
        prefetchNext(session, index);
      },
      onPause: () => {
        if (controller.isCurrent(operation)) stopAudioSync();
      },
      onEnded: () => {
        if (!controller.isCurrent(operation)) return;
        stopAudioSync();
        publishActiveWord(null);
        advanceAfterAyahRef.current();
      },
      onError: () => {
        if (!controller.isCurrent(operation)) return;
        stopAudioSync();
        dispatch({
          type: "playback-changed",
          playing: false,
          error: "audioPlay",
        });
      },
    });
  };

  const startListening = useCallback(
    async (built: BuiltListenSession) => {
      stop();
      const first = built.playlist[0];
      if (!first) return;

      const quranComId = getQuranComRecitationId(reciter.id);
      sessionRef.current = {
        playlist: built.playlist,
        index: 0,
        repeatMode: built.repeatMode,
        repeatCount: built.repeatCount,
        repeatEachAyah: built.repeatEachAyah,
        blockRepeatDone: 0,
        unitRepeatLeft:
          built.repeatEachAyah && built.repeatMode === "count"
            ? built.repeatCount
            : 0,
        scopePlan: built.plan,
        quranComId,
        supportsWordHighlight: Boolean(quranComId),
        surahTimestampsCache: new Map(),
      };

      await playAtIndexRef.current(0);
    },
    [reciter.id, stop],
  );

  const startAyahPlayback = useCallback(
    async (surah: number, ayah: number) => {
      const surahAyahCount = SURAH_AYAH_COUNTS[surah - 1] ?? 0;
      const playlist = Array.from(
        { length: Math.max(0, surahAyahCount - ayah + 1) },
        (_, index) => ({ surah, ayah: ayah + index }),
      );

      await startListening({
        playlist,
        repeatMode: "none",
        repeatCount: 1,
        repeatEachAyah: false,
        plan: {
          scope: "surah",
          surah,
          ayah,
          repeatMode: "none",
          repeatCount: 1,
        },
      });
    },
    [startListening],
  );

  const startAyahRepeat = useCallback(
    async (surah: number, ayah: number, repeat: number | "infinite") => {
      const infinite = repeat === "infinite";
      const count = infinite ? 1 : Math.max(1, repeat);

      await startListening({
        // One item, repeated in place: repeatEachAyah so the bar can count
        // the passes rather than treating them as one long block.
        playlist: [{ surah, ayah }],
        repeatMode: infinite ? "infinite" : "count",
        repeatCount: count,
        repeatEachAyah: true,
        plan: {
          scope: "ayah",
          surah,
          ayah,
          repeatMode: infinite ? "infinite" : "count",
          repeatCount: count,
        },
      });
    },
    [startListening],
  );

  const pause = useCallback(() => {
    audioPlayer.pause();
    dispatch({ type: "playback-changed", playing: false, error: null });
  }, [audioPlayer]);

  const resume = useCallback(() => {
    if (state.error) {
      void playAtIndexRef.current(sessionRef.current.index);
      return;
    }
    void audioPlayer.resume();
  }, [audioPlayer, state.error]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!stateRef.current.active || session.playlist.length === 0) return;

    const quranComId = getQuranComRecitationId(reciter.id);
    session.quranComId = quranComId;
    session.supportsWordHighlight = Boolean(quranComId);
    session.surahTimestampsCache.clear();
    presentCurrentItem();

    if (stateRef.current.playing) {
      void playAtIndexRef.current(session.index);
    }
  }, [presentCurrentItem, reciter.id]);

  const goToVerse = useCallback((verseKey: string) => {
    pendingVerseKeyRef.current = verseKey;
    if (!pageNavigatorRef.current) return;
    pageNavigatorRef.current(verseKey);
    pendingVerseKeyRef.current = null;
  }, []);

  const registerPageNavigator = useCallback(
    (navigator: ((verseKey: string) => void) | null) => {
      pageNavigatorRef.current = navigator;
      if (!navigator || !pendingVerseKeyRef.current) return;
      navigator(pendingVerseKeyRef.current);
      pendingVerseKeyRef.current = null;
    },
    [],
  );

  const setActiveVerseInView = useCallback((inView: boolean) => {
    dispatch({ type: "verse-visibility-changed", inView });
  }, []);

  const setAutoFollowPages = useCallback((follow: boolean) => {
    dispatch({ type: "auto-follow-changed", follow });
  }, []);

  const seekToItem = useCallback(
    (index: number) => {
      const session = sessionRef.current;
      const item = session.playlist[index];
      if (!item || !stateRef.current.active) return;
      /* A repeated ayah sought to is heard its full number of times. */
      if (session.repeatEachAyah && session.repeatMode === "count") {
        session.unitRepeatLeft = session.repeatCount;
      }
      setAutoFollowPages(true);
      goToVerse(`${item.surah}:${item.ayah}`);
      void playAtIndexRef.current(index);
    },
    [goToVerse, setAutoFollowPages],
  );

  const seekToFraction = useCallback(
    (fraction: number) => {
      const session = sessionRef.current;
      seekToItem(
        playlistIndexAt({
          playlist: session.playlist,
          fraction,
          timestamps: session.surahTimestampsCache,
        }),
      );
    },
    [seekToItem],
  );

  useEffect(() => cancelCurrentSession, [cancelCurrentSession]);

  const actions = useMemo<QuranPlaybackActions>(
    () => ({
      startListening,
      startAyahPlayback,
      startAyahRepeat,
      pause,
      resume,
      stop,
      registerPageNavigator,
      goToVerse,
      seekToItem,
      seekToFraction,
      setActiveVerseInView,
      setAutoFollowPages,
    }),
    [
      startListening,
      startAyahPlayback,
      startAyahRepeat,
      pause,
      resume,
      stop,
      registerPageNavigator,
      goToVerse,
      seekToItem,
      seekToFraction,
      setActiveVerseInView,
      setAutoFollowPages,
    ],
  );
  const highlight = useMemo<QuranPlaybackHighlightState>(
    () => ({ activeWordLocation }),
    [activeWordLocation],
  );

  return (
    <QuranPlaybackActionsContext.Provider value={actions}>
      <QuranPlaybackStateContext.Provider value={state}>
        <QuranPlaybackHighlightContext.Provider value={highlight}>
          <QuranPlaybackTimeContext.Provider value={playbackTime}>
            {children}
          </QuranPlaybackTimeContext.Provider>
        </QuranPlaybackHighlightContext.Provider>
      </QuranPlaybackStateContext.Provider>
    </QuranPlaybackActionsContext.Provider>
  );
}

export function useQuranPlaybackTime(): PlaybackTime {
  const context = useContext(QuranPlaybackTimeContext);
  if (!context) {
    throw new Error(
      "useQuranPlaybackTime must be used within QuranPlaybackProvider",
    );
  }
  return context;
}

export function useQuranPlaybackState(): QuranPlaybackState {
  const context = useContext(QuranPlaybackStateContext);
  if (!context) {
    throw new Error(
      "useQuranPlaybackState must be used within QuranPlaybackProvider",
    );
  }
  return context;
}

export function useQuranPlaybackHighlight(): QuranPlaybackHighlightState {
  const context = useContext(QuranPlaybackHighlightContext);
  if (!context) {
    throw new Error(
      "useQuranPlaybackHighlight must be used within QuranPlaybackProvider",
    );
  }
  return context;
}

export function useQuranPlaybackActions(): QuranPlaybackActions {
  const context = useContext(QuranPlaybackActionsContext);
  if (!context) {
    throw new Error(
      "useQuranPlaybackActions must be used within QuranPlaybackProvider",
    );
  }
  return context;
}
