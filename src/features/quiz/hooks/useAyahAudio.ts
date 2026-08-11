import { useEffect, useRef, useState } from "react";
import { CancellableAudioPlayer } from "@/shared/media";

export type AyahAudioStatus = "idle" | "loading" | "playing" | "error";

function isAutoplayBlocked(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "AbortError")
  );
}

async function startAudio(
  player: CancellableAudioPlayer,
  url: string,
  setStatus: (status: AyahAudioStatus) => void,
): Promise<void> {
  setStatus("loading");
  const result = await player.play(url, {
    onPlaying: () => setStatus("playing"),
    onEnded: () => setStatus("idle"),
    onError: (error) => setStatus(isAutoplayBlocked(error) ? "idle" : "error"),
  });
  if (result.status === "error") {
    setStatus(isAutoplayBlocked(result.error) ? "idle" : "error");
  }
}

export function useAyahAudio(url: string) {
  const playerRef = useRef<CancellableAudioPlayer | null>(null);
  if (!playerRef.current) playerRef.current = new CancellableAudioPlayer();
  const player = playerRef.current;
  const [status, setStatus] = useState<AyahAudioStatus>("idle");

  useEffect(() => {
    void startAudio(player, url, setStatus);
    return () => player.dispose();
  }, [player, url]);

  function play(): void {
    void startAudio(player, url, setStatus);
  }

  function stop(): void {
    player.stop();
    setStatus("idle");
  }

  return { status, play, stop };
}
