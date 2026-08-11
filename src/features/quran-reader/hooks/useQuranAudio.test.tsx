// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useQuranAudio } from "./useQuranAudio";

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playResults: Promise<void>[] = [];

  currentTime = 0;
  paused = false;
  listeners = new Map<string, Set<EventListener>>();
  pause = vi.fn();
  removeAttribute = vi.fn();
  play = vi.fn(() => FakeAudio.playResults.shift() ?? Promise.resolve());

  constructor(public readonly src: string) {
    FakeAudio.instances.push(this);
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener) {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type));
    }
  }
}

describe("useQuranAudio", () => {
  afterEach(() => {
    FakeAudio.instances = [];
    FakeAudio.playResults = [];
    vi.unstubAllGlobals();
  });

  it("ignores a rejected play after a replacement session starts", async () => {
    let rejectFirst!: (error: Error) => void;
    const firstPlay = new Promise<void>((_resolve, reject) => {
      rejectFirst = reject;
    });
    FakeAudio.playResults = [firstPlay, Promise.resolve()];
    vi.stubGlobal("Audio", FakeAudio);

    const { result } = renderHook(() => useQuranAudio());
    let firstRequest!: Promise<void>;
    await act(async () => {
      firstRequest = result.current.play("first.mp3");
      await Promise.resolve();
    });

    await act(async () => {
      const secondRequest = result.current.play("second.mp3");
      await secondRequest;
    });

    await act(async () => {
      rejectFirst(new Error("stale"));
      await firstRequest;
    });

    expect(result.current.playing).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("invalidates media callbacks when stopped", async () => {
    FakeAudio.playResults = [Promise.resolve()];
    vi.stubGlobal("Audio", FakeAudio);
    const { result } = renderHook(() => useQuranAudio());

    await act(async () => {
      const request = result.current.play("ayah.mp3");
      await request;
    });

    const audio = FakeAudio.instances[0]!;
    act(() => result.current.stop());
    audio.emit("error");

    expect(result.current.playing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(audio.pause).toHaveBeenCalled();
  });
});
