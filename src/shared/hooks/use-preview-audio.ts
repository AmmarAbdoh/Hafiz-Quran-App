import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_AYAH, DEMO_SURAH } from "@/shared/constants/demoAyah";
import { getAyahAudioUrl } from "@/shared/constants/audio";
import type { ReciterOption } from "@/shared/constants/reciters";

export function usePreviewAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setPlayingUrl(null);
  }, []);

  const playUrl = useCallback(
    async (url: string) => {
      if (playingUrl === url && audioRef.current && !audioRef.current.paused) {
        stop();
        return;
      }

      stop();

      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingUrl(url);

      const handleEnd = () => {
        if (audioRef.current === audio) {
          stop();
        }
      };

      audio.addEventListener("ended", handleEnd);
      audio.addEventListener("error", handleEnd);

      try {
        await audio.play();
      } catch {
        handleEnd();
      }
    },
    [playingUrl, stop],
  );

  useEffect(() => () => stop(), [stop]);

  return {
    playUrl,
    stop,
    playingUrl,
    isPlaying: playingUrl !== null,
  };
}

export function useReciterPreview(reciter: ReciterOption) {
  const { playUrl, playingUrl, stop, isPlaying } = usePreviewAudio();
  const previewUrl = useMemo(
    () => getAyahAudioUrl(reciter, DEMO_SURAH, DEMO_AYAH),
    [reciter],
  );

  const preview = useCallback(() => {
    void playUrl(previewUrl);
  }, [playUrl, previewUrl]);

  return {
    preview,
    stop,
    isPreviewPlaying: isPlaying && playingUrl === previewUrl,
  };
}
