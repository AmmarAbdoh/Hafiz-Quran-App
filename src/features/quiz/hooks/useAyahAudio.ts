import { useEffect, useRef, useState } from "react";
import { CancellableAudioPlayer } from "@/shared/media";
import { claimAudioFocus, releaseAudioFocus } from "@/shared/media/audioFocus";

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
  if (result.status === "cancelled") {
    setStatus("idle");
    return;
  }
  if (result.status === "error") {
    setStatus(isAutoplayBlocked(result.error) ? "idle" : "error");
  }
}

export function useAyahAudio(url: string) {
  const playerRef = useRef<CancellableAudioPlayer | null>(null);
  if (!playerRef.current) playerRef.current = new CancellableAudioPlayer();
  const player = playerRef.current;
  const ownerRef = useRef({ stop: () => player.stop() });
  ownerRef.current.stop = () => {
    player.stop();
    setStatus("idle");
  };
  const [status, setStatus] = useState<AyahAudioStatus>("idle");

  useEffect(() => {
    player.stop();
    setStatus("idle");
    const owner = ownerRef.current;
    return () => {
      releaseAudioFocus(owner);
      player.dispose();
    };
  }, [player, url]);

  function play(): void {
    claimAudioFocus(ownerRef.current);
    void startAudio(player, url, setStatus);
  }

  function stop(): void {
    player.stop();
    setStatus("idle");
    releaseAudioFocus(ownerRef.current);
  }

  return { status, play, stop };
}
