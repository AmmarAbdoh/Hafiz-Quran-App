import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BuiltListenSession } from "@/features/quran-reader/types/listenPlan";
import { SURAH_NAMES } from "@/shared/constants/quran";
import { SURAH_AYAH_COUNTS } from "@/shared/constants/reciters";
import { getQuranComRecitationId } from "@/shared/constants/quranComReciters";
import { getAyahAudioUrl } from "@/shared/constants/audio";
import { useReciter } from "@/shared/hooks/use-reciter";
import {
  fetchSurahAudioMeta,
  fetchVerseAudioData,
  findActiveWordLocation,
  mergeWordSegments,
  type SurahTimestamp,
  type WordSegment,
} from "@/shared/services/quran-com-audio";

export interface QuranPlaybackState {
  active: boolean;
  playing: boolean;
  surah: number;
  surahName: string;
  startAyah: number;
  currentAyah: number;
  ayahCount: number;
  reciterName: string;
  supportsWordHighlight: boolean;
  activeVerseKey: string | null;
  activeWordLocation: string | null;
  surahDurationMs: number;
  elapsedMs: number;
  error: string | null;
  activeVerseInView: boolean;
  autoFollowPages: boolean;
  scopeLabel: string;
  playlistIndex: number;
  playlistTotal: number;
  repeatLabel: string | null;
}

interface QuranPlaybackContextValue extends QuranPlaybackState {
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

const initialState: QuranPlaybackState = {
  active: false,
  playing: false,
  surah: 0,
  surahName: "",
  startAyah: 0,
  currentAyah: 0,
  ayahCount: 0,
  reciterName: "",
  supportsWordHighlight: false,
  activeVerseKey: null,
  activeWordLocation: null,
  surahDurationMs: 0,
  elapsedMs: 0,
  error: null,
  activeVerseInView: false,
  autoFollowPages: true,
  scopeLabel: "",
  playlistIndex: 0,
  playlistTotal: 0,
  repeatLabel: null,
};

const QuranPlaybackContext = createContext<QuranPlaybackContextValue | null>(
  null,
);

interface ListenSessionRef {
  playlist: Array<{ surah: number; ayah: number }>;
  index: number;
  repeatMode: BuiltListenSession["repeatMode"];
  repeatCount: number;
  repeatEachAyah: boolean;
  blockRepeatDone: number;
  unitRepeatLeft: number;
  scopeLabel: string;
  quranComId: number | null;
  supportsWordHighlight: boolean;
  completedAyahDurationMs: number;
  surahTimestampsCache: Map<number, SurahTimestamp[]>;
}

function emptySessionRef(): ListenSessionRef {
  return {
    playlist: [],
    index: 0,
    repeatMode: "none",
    repeatCount: 1,
    repeatEachAyah: false,
    blockRepeatDone: 0,
    unitRepeatLeft: 0,
    scopeLabel: "",
    quranComId: null,
    supportsWordHighlight: false,
    completedAyahDurationMs: 0,
    surahTimestampsCache: new Map(),
  };
}

function formatRepeatLabel(session: ListenSessionRef): string | null {
  if (session.repeatMode === "infinite") return "تكرار ∞";
  if (session.repeatMode === "count" && session.repeatCount > 1) {
    if (session.repeatEachAyah) {
      return `تكرار ${session.repeatCount}× لكل آية`;
    }
    return `تكرار ${session.blockRepeatDone + 1}/${session.repeatCount}`;
  }
  return null;
}

export function QuranPlaybackProvider({ children }: { children: ReactNode }) {
  const { reciter } = useReciter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const pageNavigatorRef = useRef<((verseKey: string) => void) | null>(null);
  const pendingVerseKeyRef = useRef<string | null>(null);
  const segmentsRef = useRef<WordSegment[]>([]);
  const ayahTimestampsRef = useRef<SurahTimestamp[]>([]);
  const sessionRef = useRef<ListenSessionRef>(emptySessionRef());

  const [state, setState] = useState<QuranPlaybackState>(initialState);

  const stopSyncLoop = useCallback(() => {
    if (syncFrameRef.current !== null) {
      cancelAnimationFrame(syncFrameRef.current);
      syncFrameRef.current = null;
    }
  }, []);

  const cleanupAudio = useCallback(() => {
    stopSyncLoop();
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.src = "";
    audioRef.current.onended = null;
    audioRef.current.onpause = null;
    audioRef.current.onerror = null;
    audioRef.current = null;
  }, [stopSyncLoop]);

  const stop = useCallback(() => {
    cleanupAudio();
    segmentsRef.current = [];
    ayahTimestampsRef.current = [];
    sessionRef.current = emptySessionRef();
    setState(initialState);
  }, [cleanupAudio]);

  const getElapsedInSurahMs = useCallback(
    (currentAyah: number, currentAyahTimeMs: number) => {
      const entry = ayahTimestampsRef.current.find(
        (timestamp) => timestamp.ayah === currentAyah,
      );
      if (entry) {
        return entry.startMs + currentAyahTimeMs;
      }

      return sessionRef.current.completedAyahDurationMs + currentAyahTimeMs;
    },
    [],
  );

  const syncPlaybackState = useCallback(() => {
    if (!audioRef.current) return;

    const session = sessionRef.current;
    const current = session.playlist[session.index];
    if (!current) return;

    const currentAyahTimeMs = audioRef.current.currentTime * 1000;
    const elapsedMs = getElapsedInSurahMs(current.ayah, currentAyahTimeMs);
    const activeWordLocation = session.supportsWordHighlight
      ? findActiveWordLocation(segmentsRef.current, currentAyahTimeMs)
      : null;

    setState((prev) => {
      if (
        prev.elapsedMs === elapsedMs &&
        prev.activeWordLocation === activeWordLocation
      ) {
        return prev;
      }

      return {
        ...prev,
        elapsedMs,
        activeWordLocation,
      };
    });

    if (!audioRef.current.paused && !audioRef.current.ended) {
      syncFrameRef.current = requestAnimationFrame(syncPlaybackState);
    }
  }, [getElapsedInSurahMs]);

  const startSyncLoop = useCallback(() => {
    stopSyncLoop();
    syncFrameRef.current = requestAnimationFrame(syncPlaybackState);
  }, [stopSyncLoop, syncPlaybackState]);

  const updateUiForCurrentItem = useCallback(
    (playing: boolean, error: string | null = null) => {
      const session = sessionRef.current;
      const current = session.playlist[session.index];
      if (!current) return;

      setState((prev) => ({
        ...prev,
        active: true,
        playing,
        surah: current.surah,
        surahName: SURAH_NAMES[current.surah - 1] ?? "",
        startAyah: session.playlist[0]?.ayah ?? current.ayah,
        currentAyah: current.ayah,
        ayahCount: current.ayah,
        reciterName: reciter.nameAr,
        supportsWordHighlight: session.supportsWordHighlight,
        activeVerseKey: `${current.surah}:${current.ayah}`,
        activeWordLocation: null,
        scopeLabel: session.scopeLabel,
        playlistIndex: session.index + 1,
        playlistTotal: session.playlist.length,
        repeatLabel: formatRepeatLabel(session),
        error,
      }));
    },
    [reciter.nameAr],
  );

  const playAtIndexRef = useRef<(index: number) => Promise<void>>(
    async () => {},
  );

  const advanceAfterAyah = useRef<() => void>(() => {});

  advanceAfterAyah.current = () => {
    const session = sessionRef.current;
    const current = session.playlist[session.index];
    if (!current) {
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

  const attachAudioHandlers = useCallback(
    (audio: HTMLAudioElement, item: { surah: number; ayah: number }) => {
      audio.onpause = () => {
        stopSyncLoop();
        syncPlaybackState();
      };

      audio.onended = () => {
        const ayahTimestamp = ayahTimestampsRef.current.find(
          (entry) => entry.ayah === item.ayah,
        );
        const playedDurationMs =
          ayahTimestamp?.durationMs ??
          Math.round(
            (Number.isFinite(audio.duration) ? audio.duration : 0) * 1000,
          );
        sessionRef.current.completedAyahDurationMs += playedDurationMs;

        advanceAfterAyah.current();
      };

      audio.onerror = () => {
        setState((prev) => ({
          ...prev,
          playing: false,
          error: "تعذر تشغيل التلاوة",
        }));
      };
    },
    [stopSyncLoop, syncPlaybackState],
  );

  playAtIndexRef.current = async (index: number) => {
    const session = sessionRef.current;
    const item = session.playlist[index];
    if (!item) {
      stop();
      return;
    }

    session.index = index;
    const verseKey = `${item.surah}:${item.ayah}`;
    const quranComId = session.quranComId;

    cleanupAudio();
    segmentsRef.current = [];

    if (quranComId) {
      let timestamps = session.surahTimestampsCache.get(item.surah);
      if (!timestamps) {
        const meta = await fetchSurahAudioMeta(item.surah, quranComId);
        timestamps = meta?.ayahTimestamps ?? [];
        session.surahTimestampsCache.set(item.surah, timestamps);
      }
      ayahTimestampsRef.current = timestamps;

      const verseAudio = await fetchVerseAudioData(verseKey, quranComId);
      if (verseAudio) {
        const chapterEntry = timestamps.find((entry) => entry.ayah === item.ayah);
        segmentsRef.current = chapterEntry
          ? mergeWordSegments(
              verseAudio.segments,
              chapterEntry.chapterSegments,
              verseAudio.wordsByPosition,
            )
          : verseAudio.segments;

        const audio = new Audio(verseAudio.audioUrl);
        audioRef.current = audio;
        attachAudioHandlers(audio, item);
        try {
          await audio.play();
          updateUiForCurrentItem(true);
          startSyncLoop();
        } catch {
          updateUiForCurrentItem(false, "تعذر تشغيل التلاوة");
        }
        return;
      }
    }

    ayahTimestampsRef.current =
      session.surahTimestampsCache.get(item.surah) ?? [];
    const audio = new Audio(getAyahAudioUrl(reciter, item.surah, item.ayah));
    audioRef.current = audio;
    attachAudioHandlers(audio, item);

    try {
      await audio.play();
      updateUiForCurrentItem(true);
      startSyncLoop();
    } catch {
      updateUiForCurrentItem(false, "تعذر تشغيل التلاوة");
    }
  };

  const startListening = useCallback(
    async (built: BuiltListenSession) => {
      stop();

      const quranComId = getQuranComRecitationId(reciter.id);
      const first = built.playlist[0]!;

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
        scopeLabel: built.label,
        quranComId,
        supportsWordHighlight: Boolean(quranComId),
        completedAyahDurationMs: 0,
        surahTimestampsCache: new Map(),
      };

      setState({
        ...initialState,
        active: true,
        playing: false,
        surah: first.surah,
        surahName: SURAH_NAMES[first.surah - 1] ?? "",
        startAyah: first.ayah,
        currentAyah: first.ayah,
        ayahCount: first.ayah,
        reciterName: reciter.nameAr,
        supportsWordHighlight: Boolean(quranComId),
        activeVerseKey: `${first.surah}:${first.ayah}`,
        scopeLabel: built.label,
        playlistIndex: 1,
        playlistTotal: built.playlist.length,
        repeatLabel: formatRepeatLabel(sessionRef.current),
        autoFollowPages: true,
      });

      await playAtIndexRef.current(0);
    },
    [stop, reciter, attachAudioHandlers, cleanupAudio, startSyncLoop, updateUiForCurrentItem],
  );

  const startAyahPlayback = useCallback(
    async (surah: number, ayah: number) => {
      const ayahCount = SURAH_AYAH_COUNTS[surah - 1] ?? 0;
      const playlist = Array.from({ length: ayahCount - ayah + 1 }, (_, index) => ({
        surah,
        ayah: ayah + index,
      }));

      await startListening({
        playlist,
        repeatMode: "none",
        repeatCount: 1,
        repeatEachAyah: false,
        label: `سورة ${SURAH_NAMES[surah - 1] ?? surah} — من ${surah}:${ayah}`,
      });
    },
    [startListening],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setState((prev) => ({ ...prev, playing: false }));
  }, []);

  const resume = useCallback(() => {
    if (!audioRef.current) return;
    void audioRef.current.play();
    setState((prev) => ({ ...prev, playing: true, error: null }));
    startSyncLoop();
  }, [startSyncLoop]);

  const goToVerse = useCallback((verseKey: string) => {
    pendingVerseKeyRef.current = verseKey;
    if (pageNavigatorRef.current) {
      pageNavigatorRef.current(verseKey);
      pendingVerseKeyRef.current = null;
    }
  }, []);

  const setActiveVerseInView = useCallback((inView: boolean) => {
    setState((prev) =>
      prev.activeVerseInView === inView
        ? prev
        : { ...prev, activeVerseInView: inView },
    );
  }, []);

  const setAutoFollowPages = useCallback((follow: boolean) => {
    setState((prev) =>
      prev.autoFollowPages === follow ? prev : { ...prev, autoFollowPages: follow },
    );
  }, []);

  const registerPageNavigator = useCallback(
    (navigator: ((verseKey: string) => void) | null) => {
      pageNavigatorRef.current = navigator;
      if (navigator && pendingVerseKeyRef.current) {
        navigator(pendingVerseKeyRef.current);
        pendingVerseKeyRef.current = null;
      }
    },
    [],
  );

  useEffect(() => () => stop(), [stop]);

  const value = useMemo(
    () => ({
      ...state,
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
      state,
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

  return (
    <QuranPlaybackContext.Provider value={value}>
      {children}
    </QuranPlaybackContext.Provider>
  );
}

export function useQuranPlayback() {
  const context = useContext(QuranPlaybackContext);
  if (!context) {
    throw new Error("useQuranPlayback must be used within QuranPlaybackProvider");
  }
  return context;
}
