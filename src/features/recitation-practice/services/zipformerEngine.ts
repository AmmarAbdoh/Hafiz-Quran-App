/*
 * The recogniser's lifetime, as the app sees it.
 *
 * Everything hard lives elsewhere: the worker holds the streaming session,
 * the tracker holds the place in the page. This is the thin thing between
 * them - start it, push audio at it, get words back, stop it.
 */
import {
  PRACTICE_MODEL_URL,
  PRACTICE_TOKENS_URL,
} from "@/features/recitation-practice/model/practiceConfig";
import type { PhonemeEmission } from "@/features/recitation-practice/model/ctcGreedy";

export interface ZipformerCallbacks {
  onUnits: (units: PhonemeEmission[]) => void;
  /**
   * One score per word asked about, once the run has been scored, and the
   * phonemes heard where each of them was expected. Both empty when there
   * was nothing to judge.
   */
  onScores: (scores: number[], heard: string[][]) => void;
  onError: (message: string, fatal: boolean) => void;
}

export interface ZipformerEngine {
  /**
   * Start a run against the words a page expects, reported to `callbacks`.
   *
   * Forgets any earlier run but keeps the loaded model. Every run used to
   * start a worker of its own, so reciting again or turning the page meant
   * fetching 72MB and building a session all over. Whatever the worker still
   * had to say about the earlier run is dropped.
   */
  begin: (
    callbacks: ZipformerCallbacks,
    labels: number[],
    spans: { from: number; to: number }[],
  ) => void;
  push: (samples: Float32Array) => void;
  /** Ask for the verdict on words `from` to `to`; answers through `onScores`. */
  score: (words: { from: number; to: number }) => void;
  /** False once the worker has died, after which a new engine is needed. */
  readonly usable: boolean;
  stop: () => void;
}

interface WorkerReply {
  type:
    | "ready"
    | "progress"
    | "units"
    | "scores"
    | "error"
    | "reset"
    | "disposed";
  units?: PhonemeEmission[];
  scores?: number[];
  /** Per word, what the recogniser heard where it was expected. */
  heard?: string[][];
  /** Percent of the weights downloaded, while loading. */
  progress?: number;
  message?: string;
  fatal?: boolean;
}

export async function startZipformer(
  options: {
    signal?: AbortSignal;
    reload?: boolean;
    /** Percent of the weights downloaded; see `modelFileBytes`. */
    onProgress?: (percent: number) => void;
  } = {},
): Promise<ZipformerEngine> {
  const worker = new Worker(
    new URL("../workers/zipformer.worker.ts", import.meta.url),
    { type: "module" },
  );

  const stop = () => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cancel = () => settle(new Error("cancelled"));
    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      worker.onerror = null;
      options.signal?.removeEventListener("abort", cancel);
      if (error) {
        stop();
        reject(error);
      } else {
        resolve();
      }
    };

    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data.type === "ready") settle();
      else if (event.data.type === "progress") {
        options.onProgress?.(event.data.progress ?? 0);
      } else if (event.data.type === "error") {
        settle(new Error(event.data.message ?? "recogniser failed to load"));
      }
    };
    worker.onerror = () => settle(new Error("recogniser worker unavailable"));
    options.signal?.addEventListener("abort", cancel, { once: true });

    worker.postMessage({
      type: "init",
      modelUrl: PRACTICE_MODEL_URL,
      tokensUrl: PRACTICE_TOKENS_URL,
      reload: options.reload ?? false,
    });
  });

  let callbacks: ZipformerCallbacks | null = null;
  /* Resets sent and not yet answered: until then, replies are a past run's. */
  let resetsPending = 0;
  let usable = true;

  // Loading is over; from here every message is recitation.
  worker.onmessage = (event: MessageEvent<WorkerReply>) => {
    const reply = event.data;
    if (reply.type === "reset") {
      resetsPending -= 1;
      return;
    }
    if (resetsPending > 0 || !callbacks) return;
    if (reply.type === "units" && reply.units) {
      callbacks.onUnits(reply.units);
      return;
    }
    if (reply.type === "scores") {
      callbacks.onScores(reply.scores ?? [], reply.heard ?? []);
      return;
    }
    if (reply.type === "error") {
      const message: string = reply.message ?? "recogniser error";
      const fatal: boolean = reply.fatal ?? false;
      callbacks.onError(message, fatal);
    }
  };
  worker.onerror = () => {
    usable = false;
    callbacks?.onError("recogniser worker stopped", true);
  };

  return {
    begin: (next, labels, spans) => {
      callbacks = next;
      resetsPending += 1;
      worker.postMessage({ type: "reset" });
      worker.postMessage({ type: "expect", labels, spans });
    },
    push: (samples) => worker.postMessage({ type: "audio", samples }),
    score: ({ from, to }) => worker.postMessage({ type: "score", from, to }),
    get usable() {
      return usable;
    },
    stop: () => {
      usable = false;
      stop();
    },
  };
}
