import { useEffect, useRef, useState } from "react";
import { CancellableAudioPlayer } from "@/shared/media";
import { getAyahAudioUrl } from "./audioUrls";
import { DEMO_AYAH, DEMO_SURAH } from "./demoAyah";
import type { ReciterOption } from "./reciters";

export function usePreviewAudio() {
  const playerRef = useRef<CancellableAudioPlayer | null>(null);
  if (!playerRef.current) playerRef.current = new CancellableAudioPlayer();
  const player = playerRef.current;
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);

  const stop = () => {
    player.stop();
    setPlayingUrl(null);
  };

  const playUrl = async (url: string) => {
    if (player.currentSource === url) {
      stop();
      return;
    }

    setPlayingUrl(url);
    await player.play(url, {
      onEnded: () => setPlayingUrl(null),
      onError: () => setPlayingUrl(null),
    });
  };

  useEffect(() => () => player.dispose(), [player]);

  return {
    playUrl,
    stop,
    playingUrl,
    isPlaying: playingUrl !== null,
  };
}

export function useReciterPreview(reciter: ReciterOption) {
  const { playUrl, playingUrl, stop, isPlaying } = usePreviewAudio();
  const previewUrl = getAyahAudioUrl(reciter, DEMO_SURAH, DEMO_AYAH);

  return {
    preview: () => void playUrl(previewUrl),
    stop,
    isPreviewPlaying: isPlaying && playingUrl === previewUrl,
  };
}
