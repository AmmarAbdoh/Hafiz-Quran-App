import {

  env,

  pipeline,

  type AutomaticSpeechRecognitionPipeline,

} from "@huggingface/transformers";

import {
  getWhisperPipelineOptions,
  getWhisperTranscribeOptions,
} from "@/shared/constants/recitation-practice";



env.allowLocalModels = false;

env.useBrowserCache = true;



let transcriber: AutomaticSpeechRecognitionPipeline | null = null;

let currentModelId: string | null = null;

let currentDtype: string | null = null;

let transcribing = false;



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

    if (data.type === "init" || data.type === "transcribe") {

      transcriber = null;

      currentModelId = null;

      currentDtype = null;

    }



    self.postMessage({

      type: "error",

      message: error instanceof Error ? error.message : "Whisper worker error",

      fatal: data.type === "init",

    });

  } finally {

    if (data.type === "transcribe") {

      transcribing = false;

    }

  }

};


