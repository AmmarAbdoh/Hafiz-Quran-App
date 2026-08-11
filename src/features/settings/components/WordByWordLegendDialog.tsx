import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocale } from "@/app/i18n";
import {
  DEMO_AYAH_LABEL,
  DEMO_VERSE_KEY,
  DEFAULT_RECITER_ID,
  fetchVerseAudioData,
  findActiveWordLocation,
  getQuranComRecitationId,
  getReciterById,
  supportsAyahWordHighlight,
  type WordSegment,
} from "@/domain/quran";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import { CancellableAudioPlayer } from "@/shared/media";

interface DemoWord {
  location: string;
  position: number;
  text: string;
}

interface WordByWordLegendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reciterId: string;
}

const QURAN_COM_API = "https://api.quran.com/api/v4";

async function fetchDemoWords(
  verseKey: string,
  signal: AbortSignal,
): Promise<DemoWord[]> {
  const response = await fetch(
    `${QURAN_COM_API}/verses/by_key/${encodeURIComponent(verseKey)}?words=true&word_fields=text_uthmani,location,position,char_type_name`,
    { signal },
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    verse?: {
      words?: Array<{
        text_uthmani: string;
        location: string;
        position: number;
        char_type_name: string;
      }>;
    };
  };

  return (data.verse?.words ?? [])
    .filter((word) => word.char_type_name !== "end")
    .sort((a, b) => a.position - b.position)
    .map((word) => ({
      location: word.location,
      position: word.position,
      text: word.text_uthmani,
    }));
}

export function WordByWordLegendDialog({
  open,
  onOpenChange,
  reciterId,
}: WordByWordLegendDialogProps) {
  const { locale } = useLocale();
  const { t } = useTranslation("settings");
  const { t: tErrors } = useTranslation("errors");
  const { t: tCommon } = useTranslation("common");
  const [words, setWords] = useState<DemoWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioPlayerRef = useRef<CancellableAudioPlayer | null>(null);
  if (!audioPlayerRef.current) {
    audioPlayerRef.current = new CancellableAudioPlayer();
  }
  const audioPlayer = audioPlayerRef.current;
  const segmentsRef = useRef<WordSegment[]>([]);
  const syncFrameRef = useRef<number | null>(null);
  const operationIdRef = useRef(0);
  const playbackFetchRef = useRef<AbortController | null>(null);

  const selectedSupports = supportsAyahWordHighlight(reciterId);
  const demoReciterId = selectedSupports ? reciterId : DEFAULT_RECITER_ID;
  const demoReciter = getReciterById(demoReciterId);
  const recitationId = getQuranComRecitationId(demoReciterId);

  const stopPlayback = useCallback(() => {
    operationIdRef.current += 1;
    playbackFetchRef.current?.abort();
    playbackFetchRef.current = null;
    if (syncFrameRef.current !== null) {
      cancelAnimationFrame(syncFrameRef.current);
      syncFrameRef.current = null;
    }
    audioPlayer.stop();
    segmentsRef.current = [];
    setPlaying(false);
    setLoadingAudio(false);
    setActiveLocation(null);
  }, [audioPlayer]);

  useEffect(() => {
    if (!open) {
      stopPlayback();
      return;
    }

    const controller = new AbortController();
    const operationId = ++operationIdRef.current;
    setLoadingWords(true);
    setError(null);

    fetchDemoWords(DEMO_VERSE_KEY, controller.signal)
      .then((loaded) => {
        if (operationIdRef.current === operationId) {
          setWords(loaded);
          setLoadingWords(false);
        }
      })
      .catch((cause: unknown) => {
        if (
          operationIdRef.current === operationId &&
          !(cause instanceof DOMException && cause.name === "AbortError")
        ) {
          setLoadingWords(false);
          setError(tErrors("wordTextLoad"));
        }
      });

    return () => {
      controller.abort();
      stopPlayback();
    };
  }, [open, stopPlayback, tErrors]);

  const syncHighlight = useCallback(() => {
    const audio = audioPlayer.currentAudio;
    if (!audio || audio.paused) return;

    const location = findActiveWordLocation(
      segmentsRef.current,
      audio.currentTime * 1000,
    );
    setActiveLocation(location);
    syncFrameRef.current = requestAnimationFrame(syncHighlight);
  }, [audioPlayer]);

  const handlePlay = async () => {
    if (playing) {
      stopPlayback();
      return;
    }

    if (!recitationId) {
      setError(tErrors("highlightUnavailable"));
      return;
    }

    const operationId = ++operationIdRef.current;
    const controller = new AbortController();
    playbackFetchRef.current?.abort();
    playbackFetchRef.current = controller;
    setLoadingAudio(true);
    setError(null);

    try {
      const verseAudio = await fetchVerseAudioData(
        DEMO_VERSE_KEY,
        recitationId,
        controller.signal,
      );
      if (operationIdRef.current !== operationId || controller.signal.aborted) {
        return;
      }
      if (!verseAudio?.audioUrl || verseAudio.segments.length === 0) {
        setError(tErrors("audioLoad"));
        return;
      }

      segmentsRef.current = verseAudio.segments;
      await audioPlayer.play(verseAudio.audioUrl, {
        signal: controller.signal,
        onPlaying: () => {
          if (operationIdRef.current !== operationId) return;
          setPlaying(true);
          syncFrameRef.current = requestAnimationFrame(syncHighlight);
        },
        onEnded: () => {
          if (operationIdRef.current !== operationId) return;
          if (syncFrameRef.current !== null) {
            cancelAnimationFrame(syncFrameRef.current);
            syncFrameRef.current = null;
          }
          setPlaying(false);
          setActiveLocation(null);
        },
        onError: () => {
          if (operationIdRef.current !== operationId) return;
          if (syncFrameRef.current !== null) {
            cancelAnimationFrame(syncFrameRef.current);
            syncFrameRef.current = null;
          }
          setPlaying(false);
          setActiveLocation(null);
          setError(tErrors("audioPlay"));
        },
      });
    } catch (cause: unknown) {
      if (
        operationIdRef.current === operationId &&
        !(cause instanceof DOMException && cause.name === "AbortError")
      ) {
        setError(tErrors("audioPlay"));
        setPlaying(false);
      }
    } finally {
      if (operationIdRef.current === operationId) {
        playbackFetchRef.current = null;
        setLoadingAudio(false);
      }
    }
  };

  const demoReciterName =
    locale === "ar" ? demoReciter.nameAr : demoReciter.nameEn;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={tCommon("actions.close")}
        className="max-h-[85vh] max-w-md overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{t("recitation.guide.title")}</DialogTitle>
          <DialogDescription>
            {t("recitation.guide.description")}
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-3 text-sm">
          <li className="rounded-lg border bg-muted/40 p-3">
            <p className="font-medium">{t("recitation.guide.howTitle")}</p>
            <p className="mt-1 text-muted-foreground">
              {t("recitation.guide.howDescription")}
            </p>
          </li>
          <li className="rounded-lg border bg-muted/40 p-3">
            <p className="font-medium">{t("recitation.guide.supportTitle")}</p>
            <p className="mt-1 text-muted-foreground">
              {t("recitation.guide.supportDescription")}
            </p>
          </li>
        </ul>

        <div className="rounded-xl border bg-background p-4">
          <p className="mb-3 text-center text-xs text-muted-foreground">
            {t("recitation.guide.example")}: {DEMO_AYAH_LABEL}
          </p>

          {loadingWords ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              className="quran-text font-mushaf flex flex-nowrap items-center justify-center gap-x-2 overflow-x-auto text-2xl leading-loose whitespace-nowrap"
              dir="rtl"
            >
              {(words.length > 0 ? words : []).map((word) => {
                const isActive = activeLocation === word.location;
                return (
                  <span
                    key={word.location}
                    className={cn(
                      "rounded px-1 transition-colors",
                      isActive &&
                        "bg-primary/35 shadow-[0_0_0_1px] shadow-primary/40",
                    )}
                  >
                    {word.text}
                  </span>
                );
              })}
              {words.length === 0 && (
                <span className="text-lg">{DEMO_AYAH_LABEL}</span>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              onClick={() => void handlePlay()}
              disabled={loadingAudio || loadingWords}
            >
              {loadingAudio ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : playing ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {playing
                ? t("recitation.guide.stop")
                : t("recitation.guide.play")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {selectedSupports
                ? t("recitation.guide.selectedVoice", { name: demoReciterName })
                : t("recitation.guide.fallbackVoice", {
                    name: demoReciterName,
                  })}
            </p>
          </div>

          {error && (
            <p className="mt-2 text-center text-xs text-destructive">{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
