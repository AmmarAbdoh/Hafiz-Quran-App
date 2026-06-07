export type ListenScopeType =
  | "ayah"
  | "ayah-range"
  | "page"
  | "page-range"
  | "surah"
  | "juz";

export type RepeatMode = "none" | "count" | "infinite";

export interface ListenPlan {
  scope: ListenScopeType;
  surah?: number;
  ayah?: number;
  endSurah?: number;
  endAyah?: number;
  page?: number;
  endPage?: number;
  juz?: number;
  repeatMode: RepeatMode;
  /** Used when repeatMode is "count". */
  repeatCount: number;
}

export interface ListenPreset {
  scope?: ListenScopeType;
  surah?: number;
  ayah?: number;
  page?: number;
  juz?: number;
}

export interface PlaylistItem {
  surah: number;
  ayah: number;
}

export interface BuiltListenSession {
  playlist: PlaylistItem[];
  repeatMode: RepeatMode;
  repeatCount: number;
  /** When true, repeat count applies to each ayah before advancing (single ayah mode). */
  repeatEachAyah: boolean;
  label: string;
}
