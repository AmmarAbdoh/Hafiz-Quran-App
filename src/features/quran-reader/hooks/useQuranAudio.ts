import { useEffect, useRef, useState } from "react";
import { CancellableAudioPlayer } from "@/shared/media";

const AUDIO_ERROR = "تعذر تشغيل الصوت";

export function useQuranAudio() {
  const playerRef = useRef<CancellableAudioPlayer | null>(null);
  if (!playerRef.current) playerRef.current = new CancellableAudioPlayer();
  const player = playerRef.current;
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    player.stop();
    setPlaying(false);
  };

  const play = async (url: string) => {
    setError(null);
    setPlaying(true);

    await player.play(url, {
      onEnded: () => setPlaying(false),
      onError: () => {
        setPlaying(false);
        setError(AUDIO_ERROR);
      },
    });
  };

  useEffect(() => () => player.dispose(), [player]);

  return { play, stop, playing, error };
}
