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
import { SURAH_NAMES } from "@/shared/constants/quran";
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
import { SURAH_AYAH_COUNTS } from "@/shared/constants/reciters";

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
}

interface QuranPlaybackContextValue extends QuranPlaybackState {
  startAyahPlayback: (surah: number, ayah: number) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  registerPageNavigator: (navigator: (verseKey: string) => void) => void;
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
};

const QuranPlaybackContext = createContext<QuranPlaybackContextValue | null>(
  null,
);

function getSurahDurationMsFromTimestamps(timestamps: SurahTimestamp[]): number {
  return (
    timestamps.at(-1)?.endMs ??
    timestamps.reduce((sum, entry) => sum + entry.durationMs, 0)
  );
}

function sumAyahDurationsBefore(
  timestamps: SurahTimestamp[],
  ayah: number,
): number {
  return timestamps
    .filter((entry) => entry.ayah < ayah)
    .reduce((sum, entry) => sum + entry.durationMs, 0);
}

export function QuranPlaybackProvider({ children }: { children: ReactNode }) {
  const { reciter } = useReciter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const syncFrameRef = useRef<number | null>(null);
  const pageNavigatorRef = useRef<((verseKey: string) => void) | null>(null);
  const segmentsRef = useRef<WordSegment[]>([]);
  const ayahTimestampsRef = useRef<SurahTimestamp[]>([]);
  const sessionRef = useRef({
    surah: 0,
    startAyah: 0,
    currentAyah: 0,
    ayahCount: 0,
    quranComId: null as number | null,
    supportsWordHighlight: false,
    completedAyahDurationMs: 0,
  });

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
    sessionRef.current = {
      surah: 0,
      startAyah: 0,
      currentAyah: 0,
      ayahCount: 0,
      quranComId: null,
      supportsWordHighlight: false,
      completedAyahDurationMs: 0,
    };
    setState(initialState);
  }, [cleanupAudio]);

  const getSurahDurationMs = useCallback(
    () => getSurahDurationMsFromTimestamps(ayahTimestampsRef.current),
    [],
  );

  const getElapsedInSurahMs = useCallback(
    (currentAyah: number, currentAyahTimeMs: number) => {
      const entry = ayahTimestampsRef.current.find(
        (timestamp) => timestamp.ayah === currentAyah,
      );
      if (entry) {
        return entry.startMs + currentAyahTimeMs;
      }

      return (
        sessionRef.current.completedAyahDurationMs + currentAyahTimeMs
      );
    },
    [],
  );

  const syncPlaybackState = useCallback(() => {
    if (!audioRef.current) return;

    const currentAyahTimeMs = audioRef.current.currentTime * 1000;
    const elapsedMs = getElapsedInSurahMs(
      sessionRef.current.currentAyah,
      currentAyahTimeMs,
    );
    const activeWordLocation = sessionRef.current.supportsWordHighlight
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

  const playAyahRef = useRef<(surah: number, ayah: number) => Promise<void>>(
    async () => {},
  );

  playAyahRef.current = async (surah: number, ayah: number) => {
    const session = sessionRef.current;
    const verseKey = `${surah}:${ayah}`;
    const quranComId = session.quranComId;

    cleanupAudio();
    segmentsRef.current = [];

    let audioUrl: string | null = null;

    if (quranComId) {
      const verseAudio = await fetchVerseAudioData(verseKey, quranComId);
      if (verseAudio) {
        audioUrl = verseAudio.audioUrl;

        const chapterEntry = ayahTimestampsRef.current.find(
          (entry) => entry.ayah === ayah,
        );
        segmentsRef.current = chapterEntry
          ? mergeWordSegments(
              verseAudio.segments,
              chapterEntry.chapterSegments,
              verseAudio.wordsByPosition,
            )
          : verseAudio.segments;
      }
    }

    if (!audioUrl) {
      audioUrl = getAyahAudioUrl(reciter, surah, ayah);
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onpause = () => {
      stopSyncLoop();
      syncPlaybackState();
    };

    audio.onended = () => {
      const ayahTimestamp = ayahTimestampsRef.current.find(
        (entry) => entry.ayah === ayah,
      );
      const playedDurationMs =
        ayahTimestamp?.durationMs ??
        Math.round(
          (Number.isFinite(audio.duration) ? audio.duration : 0) * 1000,
        );
      sessionRef.current.completedAyahDurationMs += playedDurationMs;

      if (ayahTimestamp) {
        setState((prev) => ({
          ...prev,
          elapsedMs: ayahTimestamp.endMs,
        }));
      }

      if (ayah < sessionRef.current.ayahCount) {
        sessionRef.current.currentAyah = ayah + 1;
        const nextVerseKey = `${surah}:${ayah + 1}`;
        pageNavigatorRef.current?.(nextVerseKey);
        setState((prev) => ({
          ...prev,
          currentAyah: ayah + 1,
          activeVerseKey: nextVerseKey,
          activeWordLocation: null,
        }));
        void playAyahRef.current(surah, ayah + 1);
        return;
      }

      stop();
    };

    audio.onerror = () => {
      setState((prev) => ({
        ...prev,
        playing: false,
        error: "تعذر تشغيل التلاوة",
      }));
    };

    try {
      sessionRef.current.currentAyah = ayah;
      await audio.play();
      pageNavigatorRef.current?.(verseKey);
      const elapsedMs = getElapsedInSurahMs(ayah, audio.currentTime * 1000);
      const surahDurationMs = getSurahDurationMs();
      setState((prev) => ({
        ...prev,
        active: true,
        playing: true,
        surah,
        surahName: SURAH_NAMES[surah - 1] ?? "",
        startAyah: session.startAyah,
        currentAyah: ayah,
        ayahCount: session.ayahCount,
        reciterName: reciter.nameAr,
        supportsWordHighlight: session.supportsWordHighlight,
        activeVerseKey: verseKey,
        activeWordLocation: null,
        surahDurationMs: surahDurationMs || prev.surahDurationMs,
        elapsedMs,
        error: null,
      }));
      startSyncLoop();
    } catch {
      setState((prev) => ({
        ...prev,
        playing: false,
        error: "تعذر تشغيل التلاوة",
      }));
    }
  };

  const playAyah = useCallback(async (surah: number, ayah: number) => {
    await playAyahRef.current(surah, ayah);
  }, []);

  const startAyahPlayback = useCallback(
    async (surah: number, ayah: number) => {
      stop();

      const ayahCount = SURAH_AYAH_COUNTS[surah - 1] ?? 0;
      const quranComId = getQuranComRecitationId(reciter.id);
      let ayahTimestamps: SurahTimestamp[] = [];

      if (quranComId) {
        const meta = await fetchSurahAudioMeta(surah, quranComId);
        if (meta) {
          ayahTimestamps = meta.ayahTimestamps;
        }
      }

      ayahTimestampsRef.current = ayahTimestamps;

      const startAyahEntry = ayahTimestamps.find((entry) => entry.ayah === ayah);
      const surahDurationMs = getSurahDurationMsFromTimestamps(ayahTimestamps);
      const surahElapsedMs =
        startAyahEntry?.startMs ??
        sumAyahDurationsBefore(ayahTimestamps, ayah);

      sessionRef.current = {
        surah,
        startAyah: ayah,
        currentAyah: ayah,
        ayahCount,
        quranComId,
        supportsWordHighlight: Boolean(quranComId),
        completedAyahDurationMs: surahElapsedMs,
      };

      setState({
        active: true,
        playing: false,
        surah,
        surahName: SURAH_NAMES[surah - 1] ?? "",
        startAyah: ayah,
        currentAyah: ayah,
        ayahCount,
        reciterName: reciter.nameAr,
        supportsWordHighlight: Boolean(quranComId),
        activeVerseKey: `${surah}:${ayah}`,
        activeWordLocation: null,
        surahDurationMs,
        elapsedMs: surahElapsedMs,
        error: null,
      });

      await playAyah(surah, ayah);
    },
    [playAyah, reciter.id, reciter.nameAr, stop],
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

  const registerPageNavigator = useCallback(
    (navigator: (verseKey: string) => void) => {
      pageNavigatorRef.current = navigator;
    },
    [],
  );

  useEffect(() => () => stop(), [stop]);

  const value = useMemo(
    () => ({
      ...state,
      startAyahPlayback,
      pause,
      resume,
      stop,
      registerPageNavigator,
    }),
    [state, startAyahPlayback, pause, resume, stop, registerPageNavigator],
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
