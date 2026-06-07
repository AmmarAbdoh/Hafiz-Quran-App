import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  DEMO_AYAH_LABEL,
  DEMO_VERSE_KEY,
} from "@/shared/constants/demoAyah";
import { DEFAULT_RECITER_ID, getReciterById } from "@/shared/constants/reciters";
import {
  getQuranComRecitationId,
  supportsAyahWordHighlight,
} from "@/shared/constants/quranComReciters";
import {
  fetchVerseAudioData,
  findActiveWordLocation,
  type WordSegment,
} from "@/shared/services/quran-com-audio";
import { cn } from "@/shared/lib/utils";

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

async function fetchDemoWords(verseKey: string): Promise<DemoWord[]> {
  const response = await fetch(
    `${QURAN_COM_API}/verses/by_key/${encodeURIComponent(verseKey)}?words=true&word_fields=text_uthmani,location,position,char_type_name`,
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
  const [words, setWords] = useState<DemoWord[]>([]);
  const [loadingWords, setLoadingWords] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentsRef = useRef<WordSegment[]>([]);
  const syncFrameRef = useRef<number | null>(null);

  const selectedSupports = supportsAyahWordHighlight(reciterId);
  const demoReciterId = selectedSupports ? reciterId : DEFAULT_RECITER_ID;
  const demoReciter = getReciterById(demoReciterId);
  const recitationId = getQuranComRecitationId(demoReciterId);

  const stopPlayback = useCallback(() => {
    if (syncFrameRef.current !== null) {
      cancelAnimationFrame(syncFrameRef.current);
      syncFrameRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlaying(false);
    setActiveLocation(null);
  }, []);

  useEffect(() => {
    if (!open) {
      stopPlayback();
      return;
    }

    let cancelled = false;
    setLoadingWords(true);
    setError(null);

    fetchDemoWords(DEMO_VERSE_KEY)
      .then((loaded) => {
        if (!cancelled) {
          setWords(loaded);
          setLoadingWords(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingWords(false);
          setError("تعذر تحميل نص الآية.");
        }
      });

    return () => {
      cancelled = true;
      stopPlayback();
    };
  }, [open, stopPlayback]);

  const syncHighlight = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    const location = findActiveWordLocation(
      segmentsRef.current,
      audio.currentTime * 1000,
    );
    setActiveLocation(location);
    syncFrameRef.current = requestAnimationFrame(syncHighlight);
  }, []);

  const handlePlay = useCallback(async () => {
    if (playing) {
      stopPlayback();
      return;
    }

    if (!recitationId) {
      setError("لا تتوفر بيانات التمييز لهذا القارئ.");
      return;
    }

    setLoadingAudio(true);
    setError(null);

    try {
      const verseAudio = await fetchVerseAudioData(DEMO_VERSE_KEY, recitationId);
      if (!verseAudio?.audioUrl || verseAudio.segments.length === 0) {
        setError("تعذر تحميل التسجيل التجريبي.");
        return;
      }

      segmentsRef.current = verseAudio.segments;
      const audio = new Audio(verseAudio.audioUrl);
      audioRef.current = audio;

      audio.addEventListener("ended", stopPlayback);
      audio.addEventListener("error", stopPlayback);

      await audio.play();
      setPlaying(true);
      syncFrameRef.current = requestAnimationFrame(syncHighlight);
    } catch {
      setError("تعذر تشغيل التسجيل.");
      stopPlayback();
    } finally {
      setLoadingAudio(false);
    }
  }, [playing, recitationId, stopPlayback, syncHighlight]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تمييز كلمة بكلمة</DialogTitle>
          <DialogDescription>
            أثناء تلاوة الآية يُميَّز كلُّ كلمة عند نطقها — كما في المصحف أثناء
            الاستماع.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-3 text-sm">
          <li className="rounded-lg border bg-muted/40 p-3">
            <p className="font-medium">كيف يعمل؟</p>
            <p className="mt-1 text-muted-foreground">
              عند تشغيل الآية تُبرَز الكلمة الجارية واحدةً تلو الأخرى أثناء
              نطقها — كما في المثال أدناه.
            </p>
          </li>
          <li className="rounded-lg border bg-muted/40 p-3">
            <p className="font-medium">من يدعم هذه الميزة؟</p>
            <p className="mt-1 text-muted-foreground">
              القراء الموسومون بـ «تمييز كلمة بكلمة» في قائمة القراء. باقي القراء
              يشغّلون الآية كاملة دون تمييز الكلمات.
            </p>
          </li>
        </ul>

        <div className="rounded-xl border bg-background p-4">
          <p className="mb-3 text-center text-xs text-muted-foreground">
            مثال: {DEMO_AYAH_LABEL}
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
              {playing ? "إيقاف المثال" : "شغّل المثال"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {selectedSupports
                ? `التجربة بصوت ${demoReciter.nameAr}`
                : `القارئ المختار لا يدعم التمييز — المثال بصوت ${demoReciter.nameAr}`}
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
