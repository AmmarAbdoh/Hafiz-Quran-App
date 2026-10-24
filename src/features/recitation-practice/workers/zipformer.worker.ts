/*
 * The streaming phoneme recogniser, in the browser.
 *
 * Imported from `onnxruntime-web/wasm` rather than the package root: the
 * default entry is the WebGPU bundle, which drags in a second runtime binary
 * this never uses. The wasm build resolves its own `.wasm` through Vite, so
 * unlike the Whisper worker it needs no CDN override at all.
 *
 * Unlike the Whisper worker beside it, this one is genuinely incremental: the
 * encoder is cache-aware, so audio is handed over as it arrives and phonemes
 * come back while the reciter is still speaking. There is no window to wait
 * for and no transcript to re-run - which is what makes word-by-word possible
 * at all.
 *
 * The parts that decide accuracy live in ../model and are shared with the
 * bench; what is here is the onnxruntime-web session, the sample and frame
 * bookkeeping that turns a microphone into fixed windows, and the messaging.
 */
/* The wasm-only build: the default entry drags in the WebGPU runtime, a
   second 26MB binary this never uses. */
import * as ort from "onnxruntime-web/wasm";
import { computeFbank } from "@/features/recitation-practice/model/fbank";
import {
  createCtcStreamState,
  decodeChunk,
  decodeFrames,
  type CtcStreamState,
  type PhonemeEmission,
} from "@/features/recitation-practice/model/ctcGreedy";
import {
  identityClasses,
  parseTokenTable,
} from "@/features/recitation-practice/model/phonemeTokens";
import { alignToExpected } from "@/features/recitation-practice/model/ctcAlign";
import {
  modelFileBytes,
  modelFileRequest,
  modelFileResponse,
} from "@/features/recitation-practice/services/modelFile";

/** The model's own metadata: 61 frames per step, advancing 48. */
const WINDOW_FRAMES = 61;
const ADVANCE_FRAMES = 48;
const FEATURE_DIM = 80;
/** 25ms window, 10ms hop, at 16kHz. */
const FRAME_LENGTH = 400;
const FRAME_SHIFT = 160;
/**
 * Silence to append when a recitation ends, enough for one more window.
 *
 * The encoder only runs on a full window, so when the reciter stops there are
 * up to 60 frames - 0.6 of a second - still sitting in `frameTail`, never
 * seen by the model and absent from the frames the verdict is computed over.
 * On the last word of a page that is most of the word. sherpa-onnx pads a
 * finished stream with tail silence for the same reason.
 */
const FLUSH_SAMPLES = WINDOW_FRAMES * FRAME_SHIFT;

interface InitMessage {
  type: "init";
  modelUrl: string;
  tokensUrl: string;
  /** Fetch past the browser's cached copy, after the reader asked for a fresh one. */
  reload: boolean;
}
interface AudioMessage {
  type: "audio";
  samples: Float32Array;
}
/** What the page asks for, so the recitation can be scored against it. */
interface ExpectMessage {
  type: "expect";
  labels: number[];
  spans: { from: number; to: number }[];
}
/** Score the words `from` to `to` (exclusive) of what was expected. */
interface ScoreMessage {
  type: "score";
  from: number;
  to: number;
}
type WorkerRequest =
  | InitMessage
  | AudioMessage
  | ExpectMessage
  | ScoreMessage
  | { type: "reset" }
  | { type: "dispose" };

let session: ort.InferenceSession | null = null;
let symbols: string[] = [];
let blankId = -1;
let stateNames: string[] = [];
let stateShapes = new Map<string, number[]>();
let classOf: Int32Array | undefined;
let classCount = 0;
let expected: ExpectMessage | null = null;
/*
 * Every frame of the run, kept so the recitation can be scored against the
 * page once it is over. Forced alignment needs the whole utterance - it walks
 * the best path backwards - so this is the price of a verdict that does not
 * depend on where a streaming chunk happened to fall.
 */
let history: Float32Array[] = [];
let historyFrames = 0;
/**
 * Failed audio blocks in a row, to tell a hiccup from a dead recogniser.
 *
 * Three, because the blocks are 256ms: under a second of silence before the
 * run is ended with an error the reader can act on, rather than listening
 * forever to a session that will never produce a frame.
 */
const MAX_CONSECUTIVE_AUDIO_ERRORS = 3;
let consecutiveAudioErrors = 0;
let vocabulary = 0;

let states: Record<string, ort.Tensor> = {};
let stream: CtcStreamState = createCtcStreamState();
/** Samples not yet consumed by a whole filterbank frame. */
let sampleTail: Float32Array<ArrayBufferLike> = new Float32Array(0);
/** Feature frames computed but not yet fed to the encoder. */
let frameTail: Float32Array<ArrayBufferLike> = new Float32Array(0);

function freshStates(): Record<string, ort.Tensor> {
  const next: Record<string, ort.Tensor> = {};
  for (const name of stateNames) {
    const dims = stateShapes.get(name)!;
    const size = dims.reduce((a, b) => a * b, 1);
    next[name] = new ort.Tensor("float32", new Float32Array(size), dims);
  }
  next.processed_lens = new ort.Tensor("int64", new BigInt64Array([0n]), [1]);
  return next;
}

function resetStream() {
  states = freshStates();
  stream = createCtcStreamState();
  sampleTail = new Float32Array(0);
  frameTail = new Float32Array(0);
  history = [];
  historyFrames = 0;
  consecutiveAudioErrors = 0;
}

/**
 * Score the words the reciter covered against what the page expected.
 *
 * Posts no scores when there is nothing to judge - no audio, or no way to
 * fit the words to it - so the reader can say so instead of reporting a
 * clean recitation.
 */
function scoreRun({ from, to }: ScoreMessage) {
  const words = expected?.spans.slice(from, to) ?? [];
  if (!expected || words.length === 0 || historyFrames === 0) {
    self.postMessage({ type: "scores", scores: [], heard: [] });
    return;
  }

  const flat = new Float32Array(historyFrames * vocabulary);
  let at = 0;
  for (const chunk of history) {
    flat.set(chunk, at);
    at += chunk.length;
  }
  const frames = historyFrames;
  // The run is over; holding its frames twice over is how a long one ran a
  // phone's worker out of memory.
  history = [];
  historyFrames = 0;

  /*
   * The whole run's frames, against the labels from the first word matched.
   *
   * Asymmetric, and knowingly so. Audio before the first match - an
   * isti'adha, a throat cleared - and a passage the reciter went back over
   * both have to be absorbed by one monotonic path, which can only place each
   * label once. In principle that lets a repeated passage take frames from
   * the words around it.
   *
   * Measured, it does not: over 3,595 clips, `word-repeated` recitations are
   * wrongly flagged at 1.7% against `as-recited`'s 1.6%. Trimming the history
   * to the first match would need a frame index for it that the tracker does
   * not keep, and would risk cutting off the start of the first word - the
   * opposite failure, and a worse one. Left alone deliberately; revisit with
   * a learner recording, where going back over a line is far more common than
   * these fixtures make it.
   */
  const start = words[0]!.from;
  const scores = alignToExpected(
    flat,
    frames,
    vocabulary,
    expected.labels.slice(start, words.at(-1)!.to),
    words.map((word) => ({ from: word.from - start, to: word.to - start })),
    blankId,
    classOf,
    classCount,
  );
  // Every word unreached means the alignment found no path at all.
  const aligned = scores.some((score) => score.frames > 0);
  /*
   * And what was actually there, word by word.
   *
   * The score says a word was not said as the page has it; this says what
   * was said instead, which is the part a reciter can act on. It costs one
   * more pass over the frames the alignment has just walked - the windows
   * are disjoint - against the states-by-frames lattice it took to find
   * them, so it is not worth asking only about the words that scored badly.
   * The rule that decides which those are lives in the app, not here.
   */
  self.postMessage({
    type: "scores",
    scores: aligned ? scores.map((score) => score.score) : [],
    heard: aligned
      ? scores.map((score) =>
          score.frames === 0
            ? []
            : decodeFrames(
                flat,
                vocabulary,
                score.startFrame,
                score.endFrame,
                blankId,
                symbols,
                classOf,
              ),
        )
      : [],
  });
}

function concat(
  a: Float32Array<ArrayBufferLike>,
  b: Float32Array<ArrayBufferLike>,
): Float32Array<ArrayBufferLike> {
  const out = new Float32Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

async function init(message: InitMessage) {
  const request = modelFileRequest(message.reload);
  /*
   * Reported as it arrives, because this is 72MB and the bar showed ٠٪ for
   * all of it. Only the weights are measured: the token table is a few
   * kilobytes beside them and would make the number jump about.
   */
  const [modelBytes, tokensText] = await Promise.all([
    fetch(message.modelUrl, request).then((r) =>
      modelFileBytes(modelFileResponse(r, "model"), (fraction) => {
        self.postMessage({
          type: "progress",
          progress: Math.round(fraction * 100),
        });
      }),
    ),
    fetch(message.tokensUrl, request).then((r) =>
      modelFileResponse(r, "tokens").text(),
    ),
  ]);

  session = await ort.InferenceSession.create(modelBytes);
  const table = parseTokenTable(tokensText);
  symbols = table.symbols;
  blankId = table.blankId;
  ({ classOf, classCount } = identityClasses(symbols));

  stateNames = session.inputNames.filter(
    (name) => name !== "x" && name !== "processed_lens",
  );
  stateShapes = new Map<string, number[]>();
  for (const meta of session.inputMetadata ?? []) {
    // The union also covers non-tensor inputs, which this model has none of.
    if (!("shape" in meta) || !stateNames.includes(meta.name)) continue;
    stateShapes.set(
      meta.name,
      meta.shape.map((dim) => (typeof dim === "number" ? dim : 1)),
    );
  }

  resetStream();
  self.postMessage({ type: "ready", vocabulary: symbols.length });
}

/**
 * Take whatever audio has arrived and emit whatever phonemes it completes.
 *
 * Framing has to continue across calls or every chunk boundary would invent a
 * frame edge, so the leftover samples and the leftover feature frames are both
 * carried forward.
 */
async function pushAudio(samples: Float32Array) {
  if (!session) return;

  const pending = concat(sampleTail, samples);
  const { features, frameCount } = computeFbank(pending);
  if (frameCount > 0) {
    // Keep the samples the next frame will start from.
    sampleTail = pending.slice(frameCount * FRAME_SHIFT);
    frameTail = concat(frameTail, features);
  } else {
    sampleTail = pending;
  }
  // Guard against a caller that never sends enough to complete a frame.
  if (sampleTail.length > FRAME_LENGTH * 64) {
    sampleTail = sampleTail.slice(-FRAME_LENGTH * 64);
  }

  const emissions: PhonemeEmission[] = [];
  while (frameTail.length >= WINDOW_FRAMES * FEATURE_DIM) {
    const window = frameTail.subarray(0, WINDOW_FRAMES * FEATURE_DIM);
    const outputs = await session.run({
      ...states,
      x: new ort.Tensor("float32", window.slice(), [
        1,
        WINDOW_FRAMES,
        FEATURE_DIM,
      ]),
    });

    for (const name of stateNames) states[name] = outputs[`new_${name}`]!;
    states.processed_lens = outputs.new_processed_lens!;

    const logProbs = outputs.log_probs!;
    const [, steps, vocab] = logProbs.dims as number[];
    vocabulary = vocab!;
    history.push((logProbs.data as Float32Array).slice());
    historyFrames += steps!;
    emissions.push(
      ...decodeChunk(
        logProbs.data as Float32Array,
        steps!,
        vocab!,
        symbols,
        blankId,
        stream,
      ),
    );

    frameTail = frameTail.slice(ADVANCE_FRAMES * FEATURE_DIM);
  }

  if (emissions.length > 0) {
    self.postMessage({ type: "units", units: emissions });
  }
}

/*
 * One message at a time, in the order sent.
 *
 * Handling them as they arrive let an async handler interleave with the next
 * one: a reset or a score landing while `session.run` was still working on
 * the last block, which then wrote the old run's encoder state and frames
 * into the new one.
 */
let queue: Promise<void> = Promise.resolve();
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  queue = queue.then(() => handle(event.data));
};

async function handle(message: WorkerRequest) {
  try {
    if (message.type === "init") {
      await init(message);
      return;
    }
    if (message.type === "expect") {
      expected = message;
      return;
    }
    if (message.type === "score") {
      // Drain the buffered tail first, so the run is scored on all of it.
      try {
        await pushAudio(new Float32Array(FLUSH_SAMPLES));
      } catch {
        // A fraction of a second of tail is not worth the whole verdict.
      }
      scoreRun(message);
      return;
    }
    if (message.type === "reset") {
      resetStream();
      self.postMessage({ type: "reset" });
      return;
    }
    if (message.type === "dispose") {
      await session?.release();
      session = null;
      self.postMessage({ type: "disposed" });
      return;
    }
    if (message.type === "audio") {
      await pushAudio(message.samples);
      consecutiveAudioErrors = 0;
    }
  } catch (error) {
    /*
     * One failed block is noise; every block failing is a dead recogniser.
     *
     * Only `init` used to be fatal, so a model that loaded and then threw on
     * every `session.run` reported a non-fatal error each time: the run never
     * ended, the engine stayed "usable" and was reused by the next run, and
     * the reader's offer to download the model again is hidden while a run is
     * listening. There was no way out of it but Settings.
     */
    if (message.type === "audio") consecutiveAudioErrors += 1;
    const dead = consecutiveAudioErrors >= MAX_CONSECUTIVE_AUDIO_ERRORS;
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "recogniser error",
      fatal: message.type === "init" || dead,
    });
  }
}
