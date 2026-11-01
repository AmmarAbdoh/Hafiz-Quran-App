import { useEffect, useRef, useState } from "react";
import type { RecitedMoment } from "@/features/recitation-practice/contract";

/*
 * How much around a word to play.
 *
 * The cursor reaches a word when the last sound of the one before it is
 * reported, and the recogniser reports a sound about a quarter of a second
 * after it was made. Starting a little before that and stopping a little
 * after the word was left plays the word with the end of the one before it,
 * which is how a reader recognises where they are.
 */
const LEAD_IN_SECONDS = 0.8;
const TAIL_SECONDS = 0.4;

const idle = { playing: false, position: 0, duration: 0 };

/**
 * A recording to listen back to: the whole of it, or one word's moment.
 *
 * Played through an `Audio` object rather than an `<audio>` element, as the
 * reader's own playback is, so the controls are the app's own in either
 * direction. Once it pauses - at the end of a moment, or because the reader
 * paused it - playing on is the reader's, and nothing stops it again.
 */
export function useRecordingPlayer(src: string | null, knownSeconds = 0) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const [state, setState] = useState(idle);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audio.preload = "metadata";
    audioRef.current = audio;
    const sync = () =>
      setState({
        playing: !audio.paused,
        position: audio.currentTime,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      });
    const onTimeUpdate = () => {
      const stopAt = stopAtRef.current;
      if (stopAt !== null && audio.currentTime >= stopAt) audio.pause();
      sync();
    };
    const onPause = () => {
      stopAtRef.current = null;
      sync();
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", sync);
    audio.addEventListener("loadedmetadata", sync);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audioRef.current = null;
      stopAtRef.current = null;
      setState(idle);
    };
  }, [src]);

  const start = (audio: HTMLAudioElement) =>
    void audio.play().catch(() => {
      /* Refused (no gesture, or the file is gone): nothing is playing. */
      stopAtRef.current = null;
    });

  return {
    ...state,
    /* A WAV's length is in its header, but only once that has loaded. */
    duration: state.duration || knownSeconds,
    toggle: () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) start(audio);
      else audio.pause();
    },
    seek: (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = seconds;
      setState((current) => ({ ...current, position: seconds }));
    },
    playMoment: (moment: RecitedMoment) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, moment.from - LEAD_IN_SECONDS);
      stopAtRef.current = moment.to + TAIL_SECONDS;
      start(audio);
    },
  };
}

export type RecordingPlayback = ReturnType<typeof useRecordingPlayer>;
