import type {
  ListenPlan,
  RepeatMode,
} from "@/features/quran-reader/model/listenPlanTypes";

type QuranPlaybackError = "audioPlay";

export interface QuranPlaybackState {
  active: boolean;
  playing: boolean;
  surah: number;
  surahName: string;
  currentAyah: number;
  reciterName: string;
  supportsWordHighlight: boolean;
  activeVerseKey: string | null;
  error: QuranPlaybackError | null;
  activeVerseInView: boolean;
  autoFollowPages: boolean;
  scopePlan: ListenPlan | null;
  playlistIndex: number;
  playlistTotal: number;
  repeatMode: RepeatMode;
  repeatCount: number;
  repeatEachAyah: boolean;
  repeatIteration: number;
}

export const initialQuranPlaybackState: QuranPlaybackState = {
  active: false,
  playing: false,
  surah: 0,
  surahName: "",
  currentAyah: 0,
  reciterName: "",
  supportsWordHighlight: false,
  activeVerseKey: null,
  error: null,
  activeVerseInView: false,
  autoFollowPages: true,
  scopePlan: null,
  playlistIndex: 0,
  playlistTotal: 0,
  repeatMode: "none",
  repeatCount: 1,
  repeatEachAyah: false,
  repeatIteration: 1,
};

interface PlaybackItemState {
  surah: number;
  surahName: string;
  ayah: number;
  reciterName: string;
  supportsWordHighlight: boolean;
  scopePlan: ListenPlan;
  playlistIndex: number;
  playlistTotal: number;
  repeatMode: RepeatMode;
  repeatCount: number;
  repeatEachAyah: boolean;
  repeatIteration: number;
}

export type QuranPlaybackAction =
  | { type: "reset" }
  | { type: "item-ready"; item: PlaybackItemState }
  | {
      type: "playback-changed";
      playing: boolean;
      error: QuranPlaybackError | null;
    }
  | { type: "verse-visibility-changed"; inView: boolean }
  | { type: "auto-follow-changed"; follow: boolean };

export function quranPlaybackReducer(
  state: QuranPlaybackState,
  action: QuranPlaybackAction,
): QuranPlaybackState {
  switch (action.type) {
    case "reset":
      return initialQuranPlaybackState;
    case "item-ready": {
      const { item } = action;
      return {
        ...state,
        active: true,
        playing: false,
        surah: item.surah,
        surahName: item.surahName,
        currentAyah: item.ayah,
        reciterName: item.reciterName,
        supportsWordHighlight: item.supportsWordHighlight,
        activeVerseKey: `${item.surah}:${item.ayah}`,
        error: null,
        scopePlan: item.scopePlan,
        playlistIndex: item.playlistIndex,
        playlistTotal: item.playlistTotal,
        repeatMode: item.repeatMode,
        repeatCount: item.repeatCount,
        repeatEachAyah: item.repeatEachAyah,
        repeatIteration: item.repeatIteration,
      };
    }
    case "playback-changed":
      if (state.playing === action.playing && state.error === action.error) {
        return state;
      }
      return { ...state, playing: action.playing, error: action.error };
    case "verse-visibility-changed":
      if (state.activeVerseInView === action.inView) return state;
      return { ...state, activeVerseInView: action.inView };
    case "auto-follow-changed":
      if (state.autoFollowPages === action.follow) return state;
      return { ...state, autoFollowPages: action.follow };
  }
}
