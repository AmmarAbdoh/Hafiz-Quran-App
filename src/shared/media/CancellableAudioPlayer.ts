interface AudioPlaybackSession {
  readonly id: number;
  readonly source: string;
  readonly audio: HTMLAudioElement;
}

interface AudioPlaybackHandlers {
  signal?: AbortSignal;
  onPlaying?: (session: AudioPlaybackSession) => void;
  onPause?: (session: AudioPlaybackSession) => void;
  onEnded?: (session: AudioPlaybackSession) => void;
  onError?: (error: unknown, session: AudioPlaybackSession) => void;
}

type AudioPlaybackResult =
  | { status: "playing"; session: AudioPlaybackSession }
  | { status: "cancelled"; session: AudioPlaybackSession }
  | {
      status: "error";
      error: unknown;
      session: AudioPlaybackSession;
    };

type AudioElementFactory = (source: string) => HTMLAudioElement;

interface ActiveAudioSession extends AudioPlaybackSession {
  readonly handlers: AudioPlaybackHandlers;
  detach: () => void;
}

function defaultAudioFactory(source: string): HTMLAudioElement {
  return new Audio(source);
}

/**
 * Owns one HTML audio element at a time.
 *
 * Every replacement receives a larger session id. Event handlers and play
 * promises verify that id before publishing, so work from a replaced or
 * stopped element cannot mutate the current consumer state.
 */
export class CancellableAudioPlayer {
  private nextSessionId = 0;
  private current: ActiveAudioSession | null = null;

  constructor(
    private readonly createAudio: AudioElementFactory = defaultAudioFactory,
  ) {}

  get currentAudio(): HTMLAudioElement | null {
    return this.current?.audio ?? null;
  }

  get currentSource(): string | null {
    return this.current?.source ?? null;
  }

  get currentSessionId(): number | null {
    return this.current?.id ?? null;
  }

  isCurrent(session: AudioPlaybackSession | number): boolean {
    const id = typeof session === "number" ? session : session.id;
    return this.current?.id === id;
  }

  async play(
    source: string,
    handlers: AudioPlaybackHandlers = {},
  ): Promise<AudioPlaybackResult> {
    this.releaseCurrent(false);

    const sessionId = ++this.nextSessionId;
    const audio = this.createAudio(source);
    const session: ActiveAudioSession = {
      id: sessionId,
      source,
      audio,
      handlers,
      detach: () => undefined,
    };

    const onPause = () => {
      if (!this.isCurrent(session) || !audio.paused) return;
      handlers.onPause?.(session);
    };
    const onEnded = () => {
      if (!this.isCurrent(session)) return;
      this.releaseSession(session, false);
      handlers.onEnded?.(session);
    };
    const onError = (event: Event) => {
      if (!this.isCurrent(session)) return;
      this.releaseSession(session, false);
      handlers.onError?.(event, session);
    };
    const onAbort = () => {
      if (!this.isCurrent(session)) return;
      this.stop();
    };

    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    handlers.signal?.addEventListener("abort", onAbort, { once: true });

    session.detach = () => {
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      handlers.signal?.removeEventListener("abort", onAbort);
    };
    this.current = session;

    if (handlers.signal?.aborted) {
      this.stop();
      return { status: "cancelled", session };
    }

    return this.startCurrent(session);
  }

  pause(): void {
    this.current?.audio.pause();
  }

  async resume(): Promise<AudioPlaybackResult | null> {
    const session = this.current;
    if (!session) return null;
    return this.startCurrent(session);
  }

  stop(resetPosition = true): void {
    this.nextSessionId += 1;
    this.releaseCurrent(resetPosition);
  }

  dispose(): void {
    this.stop(false);
  }

  private async startCurrent(
    session: ActiveAudioSession,
  ): Promise<AudioPlaybackResult> {
    try {
      await session.audio.play();
    } catch (error: unknown) {
      if (!this.isCurrent(session)) {
        return { status: "cancelled", session };
      }

      this.releaseSession(session, false);
      session.handlers.onError?.(error, session);
      return { status: "error", error, session };
    }

    if (!this.isCurrent(session)) {
      return { status: "cancelled", session };
    }

    session.handlers.onPlaying?.(session);
    return this.isCurrent(session)
      ? { status: "playing", session }
      : { status: "cancelled", session };
  }

  private releaseCurrent(resetPosition: boolean): void {
    const session = this.current;
    if (session) this.releaseSession(session, resetPosition);
  }

  private releaseSession(
    session: ActiveAudioSession,
    resetPosition: boolean,
  ): void {
    if (this.current !== session) return;

    this.current = null;
    session.detach();
    session.audio.pause();
    if (resetPosition) {
      try {
        session.audio.currentTime = 0;
      } catch {
        // Some unloaded media elements do not expose a writable position.
      }
    }
    session.audio.removeAttribute("src");
  }
}
