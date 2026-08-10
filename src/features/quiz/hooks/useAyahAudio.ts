import { useCallback, useEffect, useRef, useState } from "react";

export type AyahAudioStatus = "idle" | "loading" | "playing" | "error";

/**
 * Single-ayah audio player for quiz questions.
 * Unlike usePreviewAudio, play() always restarts (no toggle), callbacks are
 * stable per URL, and autoplay blocking is handled gracefully.
 */
export function useAyahAudio(url: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<AyahAudioStatus>("idle");

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audioRef.current = null;
    }
    setStatus("idle");
  }, []);

  const play = useCallback(() => {
    const previous = audioRef.current;
    if (previous) {
      previous.pause();
      previous.removeAttribute("src");
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setStatus("loading");

    const isCurrent = () => audioRef.current === audio;

    audio.addEventListener("playing", () => {
      if (isCurrent()) setStatus("playing");
    });
    audio.addEventListener("ended", () => {
      if (isCurrent()) setStatus("idle");
    });
    audio.addEventListener("error", () => {
      if (isCurrent()) setStatus("error");
    });

    audio.play().catch((error: unknown) => {
      if (!isCurrent()) return;
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        // Autoplay blocked by the browser — wait for the user to press play.
        setStatus("idle");
      } else {
        setStatus("error");
      }
    });
  }, [url]);

  useEffect(() => {
    play();
    return stop;
  }, [play, stop]);

  return { status, play, stop };
}
