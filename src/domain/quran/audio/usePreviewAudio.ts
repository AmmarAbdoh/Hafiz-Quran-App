import { useEffect, useRef, useState } from "react";
import { CancellableAudioPlayer } from "@/shared/media";
import { claimAudioFocus, releaseAudioFocus } from "@/shared/media/audioFocus";
import { getAyahAudioUrl } from "./audioUrls";
import { DEMO_AYAH, DEMO_SURAH } from "./demoAyah";
import type { ReciterOption } from "./reciters";

export function usePreviewAudio() {
  const playerRef = useRef<CancellableAudioPlayer | null>(null);
  if (!playerRef.current) playerRef.current = new CancellableAudioPlayer();
  const player = playerRef.current;
  const ownerRef = useRef({ stop: () => player.stop() });
  ownerRef.current.stop = () => {
    player.stop();
    setPlayingUrl(null);
  };
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);

  const stop = () => {
    player.stop();
    setPlayingUrl(null);
    setPreviewError(false);
    releaseAudioFocus(ownerRef.current);
  };

  const playUrl = async (url: string) => {
    if (player.currentSource === url) {
      stop();
      return;
    }

    claimAudioFocus(ownerRef.current);
    setPreviewError(false);
    setPlayingUrl(url);
    const result = await player.play(url, {
      onEnded: () => {
        setPlayingUrl(null);
        releaseAudioFocus(ownerRef.current);
      },
      onError: () => {
        setPlayingUrl(null);
        setPreviewError(true);
        releaseAudioFocus(ownerRef.current);
      },
    });
    if (result.status === "cancelled" || result.status === "error") {
      setPlayingUrl(null);
      if (result.status === "error") setPreviewError(true);
    }
  };

  useEffect(
    () => () => {
      const owner = ownerRef.current;
      releaseAudioFocus(owner);
      player.dispose();
    },
    [player],
  );

  return {
    playUrl,
    stop,
    playingUrl,
    previewError,
    isPlaying: playingUrl !== null,
  };
}

export function useReciterPreview(reciter: ReciterOption) {
  const { playUrl, playingUrl, stop, isPlaying, previewError } =
    usePreviewAudio();
  const previewUrl = getAyahAudioUrl(reciter, DEMO_SURAH, DEMO_AYAH);

  return {
    preview: () => void playUrl(previewUrl),
    stop,
    previewError,
    isPreviewPlaying: isPlaying && playingUrl === previewUrl,
  };
}
