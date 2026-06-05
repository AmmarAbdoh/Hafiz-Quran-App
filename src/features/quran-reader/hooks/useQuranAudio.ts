import { useCallback, useEffect, useRef, useState } from "react";

export function useQuranAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(false);
  }, []);

  const play = useCallback(
    async (url: string) => {
      stop();
      setError(null);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setPlaying(false);
        setError("تعذر تشغيل الصوت");
      };

      try {
        setPlaying(true);
        await audio.play();
      } catch {
        setPlaying(false);
        setError("تعذر تشغيل الصوت");
      }
    },
    [stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { play, stop, playing, error };
}
