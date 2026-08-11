import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  SURAH_AYAH_COUNTS,
  SURAH_NAMES,
  fetchSurahAudioMeta,
  fetchVerseAudioData,
  findActiveWordLocation,
  getAyahAudioUrl,
  getQuranComRecitationId,
  mergeWordSegments,
  useReciter,
  type SurahTimestamp,
  type WordSegment,
} from "@/domain/quran";
import type { BuiltListenSession } from "@/features/quran-reader/model/listenPlanTypes";
import {
  MediaOperationController,
  type MediaOperation,
} from "@/features/quran-reader/services/mediaOperationController";
import {
  initialQuranPlaybackState,
  quranPlaybackReducer,
  type QuranPlaybackState,
} from "@/features/quran-reader/model/playbackState";
import { CancellableAudioPlayer } from "@/shared/media";

export type { QuranPlaybackState } from "@/features/quran-reader/model/playbackState";

export interface QuranPlaybackHighlightState {
  activeWordLocation: string | null;
}

export interface QuranPlaybackActions {
  startListening: (session: BuiltListenSession) => Promise<void>;
  startAyahPlayback: (surah: number, ayah: number) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  registerPageNavigator: (
    navigator: ((verseKey: string) => void) | null,
  ) => void;
  goToVerse: (verseKey: string) => void;
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
const QuranPlaybackActionsContext = createContext<QuranPlaybackActions | null>(
  null,
);

export function QuranPlaybackProvider({ children }: { children: ReactNode }) {
  const { reciter } = useReciter();
  const [state, dispatch] = useReducer(
    quranPlaybackReducer,
    initialQuranPlaybackState,
  );
  const [activeWordLocation, setActiveWordLocation] = useState<string | null>(
    null,
  );

  const audioPlayerRef = useRef<CancellableAudioPlayer | null>(null);
  if (!audioPlayerRef.current) {
    audioPlayerRef.current = new CancellableAudioPlayer();
  }
  const audioPlayer = audioPlayerRef.current;
  const syncFrameRef = useRef<number | null>(null);
  const pageNavigatorRef = useRef<((verseKey: string) => void) | null>(null);
  const pendingVerseKeyRef = useRef<string | null>(null);
  const segmentsRef = useRef<WordSegment[]>([]);
  const publishedWordRef = useRef<string | null>(null);
  const sessionRef = useRef<ListenSession>(createEmptySession());
  const operationControllerRef = useRef<MediaOperationController | null>(null);
  if (!operationControllerRef.current) {
    operationControllerRef.current = new MediaOperationController();
  }

  const stopSyncLoop = useCallback(() => {
    if (syncFrameRef.current === null) return;
    cancelAnimationFrame(syncFrameRef.current);
    syncFrameRef.current = null;
  }, []);

  const publishActiveWord = useCallback((location: string | null) => {
    if (publishedWordRef.current === location) return;
    publishedWordRef.current = location;
    setActiveWordLocation(location);
  }, []);

  const cleanupAudio = useCallback(() => {
    stopSyncLoop();
    audioPlayer.stop(false);
  }, [audioPlayer, stopSyncLoop]);

  const cancelCurrentSession = useCallback(() => {
    operationControllerRef.current?.cancel();
    cleanupAudio();
    segmentsRef.current = [];
    sessionRef.current = createEmptySession();
    publishActiveWord(null);
  }, [cleanupAudio, publishActiveWord]);

  const stop = useCallback(() => {
    cancelCurrentSession();
    dispatch({ type: "reset" });
  }, [cancelCurrentSession]);

  const startWordSync = useCallback(
    (
      audio: HTMLAudioElement,
      operation: MediaOperation,
      supportsWordHighlight: boolean,
    ) => {
      stopSyncLoop();
      if (!supportsWordHighlight) {
        publishActiveWord(null);
        return;
      }

      const sync = () => {
        const controller = operationControllerRef.current;
        if (
          !controller?.isCurrent(operation) ||
          audioPlayer.currentAudio !== audio
        ) {
          return;
        }

        publishActiveWord(
          findActiveWordLocation(segmentsRef.current, audio.currentTime * 1000),
        );

        if (!audio.paused && !audio.ended) {
          syncFrameRef.current = requestAnimationFrame(sync);
        }
      };

      syncFrameRef.current = requestAnimationFrame(sync);
    },
    [audioPlayer, publishActiveWord, stopSyncLoop],
  );

  const playAtIndexRef = useRef<(index: number) => Promise<void>>(() =>
    Promise.resolve(),
  );
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
        surahName: SURAH_NAMES[item.surah - 1] ?? "",
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
    cleanupAudio();
    segmentsRef.current = [];
    presentCurrentItem();

    let audioUrl: string | null = null;
    if (session.quranComId) {
      try {
        let timestamps = session.surahTimestampsCache.get(item.surah);
        if (!timestamps) {
          const metadata = await fetchSurahAudioMeta(
            item.surah,
            session.quranComId,
            operation.signal,
          );
          if (!controller.isCurrent(operation)) return;
          timestamps = metadata?.ayahTimestamps ?? [];
          session.surahTimestampsCache.set(item.surah, timestamps);
        }

        const verseAudio = await fetchVerseAudioData(
          `${item.surah}:${item.ayah}`,
          session.quranComId,
          operation.signal,
        );
        if (!controller.isCurrent(operation)) return;

        if (verseAudio) {
          const chapterEntry = timestamps.find(
            (entry) => entry.ayah === item.ayah,
          );
          segmentsRef.current = chapterEntry
            ? mergeWordSegments(
                verseAudio.segments,
                chapterEntry.chapterSegments,
                verseAudio.wordsByPosition,
              )
            : verseAudio.segments;
          audioUrl = verseAudio.audioUrl;
        }
      } catch {
        if (!controller.isCurrent(operation)) return;
      }
    }

    if (!audioUrl) {
      audioUrl = getAyahAudioUrl(reciter, item.surah, item.ayah);
    }
    if (!controller.isCurrent(operation)) return;

    await audioPlayer.play(audioUrl, {
      signal: operation.signal,
      onPlaying: ({ audio }) => {
        if (!controller.isCurrent(operation)) return;
        dispatch({ type: "playback-changed", playing: true, error: null });
        startWordSync(audio, operation, session.supportsWordHighlight);
      },
      onPause: () => {
        if (controller.isCurrent(operation)) stopSyncLoop();
      },
      onEnded: () => {
        if (!controller.isCurrent(operation)) return;
        stopSyncLoop();
        publishActiveWord(null);
        advanceAfterAyahRef.current();
      },
      onError: () => {
        if (!controller.isCurrent(operation)) return;
        stopSyncLoop();
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

  const pause = useCallback(() => {
    audioPlayer.pause();
    dispatch({ type: "playback-changed", playing: false, error: null });
  }, [audioPlayer]);

  const resume = useCallback(() => {
    void audioPlayer.resume();
  }, [audioPlayer]);

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

  useEffect(() => cancelCurrentSession, [cancelCurrentSession]);

  const actions = useMemo<QuranPlaybackActions>(
    () => ({
      startListening,
      startAyahPlayback,
      pause,
      resume,
      stop,
      registerPageNavigator,
      goToVerse,
      setActiveVerseInView,
      setAutoFollowPages,
    }),
    [
      startListening,
      startAyahPlayback,
      pause,
      resume,
      stop,
      registerPageNavigator,
      goToVerse,
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
          {children}
        </QuranPlaybackHighlightContext.Provider>
      </QuranPlaybackStateContext.Provider>
    </QuranPlaybackActionsContext.Provider>
  );
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
