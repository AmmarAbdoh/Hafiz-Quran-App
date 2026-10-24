import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";
import { ORT_WASM_PATHS } from "@/features/recitation-practice/workers/ortRuntime";

import {
  getWhisperPipelineOptions,
  getWhisperTranscribeOptions,
} from "@/features/recitation-practice/model/practiceConfig";

/*
 * Where the inference runtime itself comes from.
 *
 * transformers.js points this at jsdelivr by default, which the app's
 * connect-src does not allow - so every recitation died on "Failed to fetch"
 * after the model files had already downloaded, with the page blanked and no
 * message. Pointing it at the copy Vite emits from our own dependency keeps
 * the request same-origin, which is both what the policy permits and what an
 * offline-first app should be doing with a 24MB runtime.
 */
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = ORT_WASM_PATHS;
}

env.allowLocalModels = false;

env.useBrowserCache = true;

let transcriber: AutomaticSpeechRecognitionPipeline | null = null;

let currentModelId: string | null = null;

let currentDtype: string | null = null;

let transcribing = false;
/**
 * Transcriptions that failed in a row, and when to give up on the model.
 *
 * One failure is a bad chunk and the model is kept; this many in a row is a
 * transcriber that is not going to work again, so it is dropped and the next
 * phrase loads a fresh one.
 */
let consecutiveFailures = 0;
const FAILURES_BEFORE_RELOAD = 3;

async function loadWithDtype(modelId: string, dtype: string) {
  return pipeline("automatic-speech-recognition", modelId, {
    ...getWhisperPipelineOptions(modelId, dtype),

    progress_callback: (progress) => {
      if (
        typeof progress === "object" &&
        progress !== null &&
        "progress" in progress
      ) {
        self.postMessage({
          type: "progress",

          progress: Math.round(Number(progress.progress) || 0),

          status: "loading",
        });
      }
    },
  });
}

async function ensureModel(modelId: string, dtype: string) {
  if (transcriber && currentModelId === modelId && currentDtype === dtype) {
    return;
  }

  transcriber = null;

  currentModelId = modelId;

  currentDtype = dtype;

  self.postMessage({ type: "progress", progress: 0, status: "loading" });

  transcriber = await loadWithDtype(modelId, dtype);

  self.postMessage({ type: "ready", modelId, dtype });
}

self.onmessage = async (event: MessageEvent) => {
  const data = event.data as {
    type: string;

    modelId?: string;

    dtype?: string;

    audio?: Float32Array;

    sampleRate?: number;
  };

  try {
    if (data.type === "init") {
      if (!data.modelId || !data.dtype) {
        throw new Error("modelId and dtype required");
      }

      await ensureModel(data.modelId, data.dtype);

      return;
    }

    if (data.type === "transcribe") {
      if (!data.modelId || !data.dtype || !data.audio) {
        throw new Error("modelId, dtype, and audio required");
      }

      if (transcribing) return;

      await ensureModel(data.modelId, data.dtype);

      if (!transcriber) throw new Error("Model not loaded");

      transcribing = true;

      self.postMessage({ type: "analyzing" });

      const result = await transcriber(
        data.audio,

        getWhisperTranscribeOptions(data.modelId),
      );

      const text =
        typeof result === "string"
          ? result
          : ((result as { text?: string }).text ?? "");

      /* It works, so the run of failures below starts again from zero. */
      consecutiveFailures = 0;

      self.postMessage({ type: "result", text: text.trim() });

      return;
    }

    if (data.type === "dispose") {
      transcriber = null;

      currentModelId = null;

      currentDtype = null;

      self.postMessage({ type: "disposed" });
    }
  } catch (error) {
    /*
     * A failed load throws the model away at once. A failed phrase does not:
     * one bad chunk used to force a full reload, and every phrase spoken
     * during that reload failed in turn, which is how a single hiccup became
     * a run that could not recognise anything.
     *
     * But a transcriber that fails every single time is broken, not
     * hiccuping, and keeping it meant the run never recovered either. So
     * failures in a row are counted, and only an unbroken run of them is
     * taken as the model itself being gone.
     */
    if (data.type === "init") {
      transcriber = null;

      currentModelId = null;

      currentDtype = null;
    } else if (data.type === "transcribe") {
      consecutiveFailures += 1;
      if (consecutiveFailures >= FAILURES_BEFORE_RELOAD) {
        transcriber = null;

        currentModelId = null;

        currentDtype = null;

        consecutiveFailures = 0;
      }
    }

    /*
     * Which model and precision, alongside what went wrong. Two of these
     * failures turned out to depend on exactly which export a browser had
     * cached, and the message alone could not tell one from another.
     */
    const model = data.modelId ?? currentModelId;
    const precision = data.dtype ?? currentDtype;
    const where = model ? ` [${model} @ ${precision ?? "?"}]` : "";

    self.postMessage({
      type: "error",

      message:
        (error instanceof Error ? error.message : "Whisper worker error") +
        where,

      fatal: data.type === "init",
    });
  } finally {
    if (data.type === "transcribe") {
      transcribing = false;
    }
  }
};
