// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { CancellableAudioPlayer } from "./CancellableAudioPlayer";

class FakeAudio {
  currentTime = 12;
  paused = false;
  ended = false;
  readonly pause = vi.fn(() => {
    this.paused = true;
  });
  readonly removeAttribute = vi.fn();
  readonly listeners = new Map<string, Set<EventListener>>();
  playResult: Promise<void> = Promise.resolve();

  readonly play = vi.fn(() => {
    this.paused = false;
    return this.playResult;
  });

  constructor(readonly src: string) {}

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  listener(type: string): EventListener {
    const listener = this.listeners.get(type)?.values().next().value;
    if (!listener) throw new Error(`Missing ${type} listener`);
    return listener;
  }
}

function createHarness(playResults: Promise<void>[] = []) {
  const audios: FakeAudio[] = [];
  const player = new CancellableAudioPlayer((source) => {
    const audio = new FakeAudio(source);
    audio.playResult = playResults.shift() ?? Promise.resolve();
    audios.push(audio);
    return audio as unknown as HTMLAudioElement;
  });
  return { audios, player };
}

describe("CancellableAudioPlayer", () => {
  it("replaces the current element and detaches its listeners", async () => {
    const { audios, player } = createHarness();

    const first = await player.play("first.mp3");
    const second = await player.play("second.mp3");

    expect(first.status).toBe("playing");
    expect(second.status).toBe("playing");
    expect(second.session.id).toBeGreaterThan(first.session.id);
    expect(audios[0]?.pause).toHaveBeenCalledOnce();
    expect(audios[0]?.removeAttribute).toHaveBeenCalledWith("src");
    expect(audios[0]?.listeners.get("ended")?.size).toBe(0);
    expect(player.currentAudio).toBe(audios[1]);
  });

  it("does not publish when stopped before play resolves", async () => {
    let resolvePlay!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolvePlay = resolve;
    });
    const { player } = createHarness([pending]);
    const onPlaying = vi.fn();

    const request = player.play("slow.mp3", { onPlaying });
    player.stop();
    resolvePlay();
    const result = await request;

    expect(result.status).toBe("cancelled");
    expect(onPlaying).not.toHaveBeenCalled();
    expect(player.currentAudio).toBeNull();
  });

  it("ignores stale ended and error callbacks after replacement", async () => {
    const { audios, player } = createHarness();
    const onEnded = vi.fn();
    const onError = vi.fn();

    await player.play("first.mp3", { onEnded, onError });
    const staleEnded = audios[0]!.listener("ended");
    const staleError = audios[0]!.listener("error");
    await player.play("second.mp3");

    staleEnded(new Event("ended"));
    staleError(new Event("error"));

    expect(onEnded).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(player.currentAudio).toBe(audios[1]);
  });

  it("pauses and resumes the current session without replacing it", async () => {
    const { audios, player } = createHarness();
    const onPause = vi.fn();
    const onPlaying = vi.fn();

    const firstResult = await player.play("ayah.mp3", {
      onPause,
      onPlaying,
    });
    player.pause();
    audios[0]!.listener("pause")(new Event("pause"));
    const resumedResult = await player.resume();

    expect(firstResult.status).toBe("playing");
    expect(resumedResult?.status).toBe("playing");
    expect(resumedResult?.session.id).toBe(firstResult.session.id);
    expect(onPause).toHaveBeenCalledOnce();
    expect(onPlaying).toHaveBeenCalledTimes(2);
  });

  it("releases the current session when play fails", async () => {
    const error = new Error("play failed");
    const { player } = createHarness([Promise.reject(error)]);
    const onError = vi.fn();

    const result = await player.play("broken.mp3", { onError });

    expect(result).toMatchObject({ status: "error", error });
    expect(onError).toHaveBeenCalledWith(error, result.session);
    expect(player.currentAudio).toBeNull();
  });

  it("cancels the current session when its operation is aborted", async () => {
    const { audios, player } = createHarness();
    const controller = new AbortController();

    await player.play("ayah.mp3", { signal: controller.signal });
    controller.abort();

    expect(audios[0]?.pause).toHaveBeenCalledOnce();
    expect(player.currentAudio).toBeNull();
  });

  it("cleans up audio, media events, and abort listeners on dispose", async () => {
    const { audios, player } = createHarness();
    const controller = new AbortController();
    const removeAbortListener = vi.spyOn(
      controller.signal,
      "removeEventListener",
    );

    await player.play("ayah.mp3", { signal: controller.signal });
    player.dispose();

    expect(audios[0]?.pause).toHaveBeenCalledOnce();
    expect(audios[0]?.removeAttribute).toHaveBeenCalledWith("src");
    expect(audios[0]?.listeners.get("pause")?.size).toBe(0);
    expect(audios[0]?.listeners.get("ended")?.size).toBe(0);
    expect(audios[0]?.listeners.get("error")?.size).toBe(0);
    expect(removeAbortListener).toHaveBeenCalledWith(
      "abort",
      expect.any(Function),
    );
    expect(player.currentAudio).toBeNull();
  });
});
