import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CancellableAudioPlayer } from "@/shared/media";
import { claimAudioFocus, releaseAudioFocus } from "@/shared/media/audioFocus";

export function useQuranAudio() {
  const { t } = useTranslation("errors");
  const playerRef = useRef<CancellableAudioPlayer | null>(null);
  if (!playerRef.current) playerRef.current = new CancellableAudioPlayer();
  const player = playerRef.current;
  const ownerRef = useRef({ stop: () => player.stop() });
  ownerRef.current.stop = () => {
    player.stop();
    setPlaying(false);
  };
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    player.stop();
    setPlaying(false);
    releaseAudioFocus(ownerRef.current);
  };

  const play = async (url: string) => {
    claimAudioFocus(ownerRef.current);
    setError(null);
    setPlaying(true);

    const result = await player.play(url, {
      onEnded: () => {
        setPlaying(false);
        releaseAudioFocus(ownerRef.current);
      },
      onError: () => {
        setPlaying(false);
        setError(t("audioPlay"));
        releaseAudioFocus(ownerRef.current);
      },
    });

    if (result.status === "cancelled") {
      if (player.currentSource === url) {
        setPlaying(false);
      }
      return;
    }

    if (result.status === "error" && player.currentSource === url) {
      setPlaying(false);
      setError(t("audioPlay"));
      releaseAudioFocus(ownerRef.current);
    }
  };

  useEffect(
    () => () => {
      releaseAudioFocus(ownerRef.current);
      player.dispose();
    },
    [player],
  );

  return { play, stop, playing, error };
}
