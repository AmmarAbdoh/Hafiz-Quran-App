/*
 * The streaming phoneme recogniser under Node, for the bench.
 *
 * Everything that decides accuracy - the filterbank, the symbol table, the
 * CTC collapse - is the app's own TypeScript, imported here unchanged (Node
 * strips the types). What is left in this file is only the onnxruntime-node
 * glue; the browser worker holds the same forty lines against
 * onnxruntime-web. Keeping the shared half shared is what stops the bench
 * from measuring something the app does not do.
 */
import { readFile } from "node:fs/promises";
import ort from "onnxruntime-node";
import { computeFbank } from "../../../src/features/recitation-practice/model/fbank.ts";
import { parseTokenTable } from "../../../src/features/recitation-practice/model/phonemeTokens.ts";
import {
  createCtcStreamState,
  decodeChunk,
} from "../../../src/features/recitation-practice/model/ctcGreedy.ts";

/** Both read from the model's own metadata: 61 frames in, advance 48. */
const WINDOW_FRAMES = 61;
const ADVANCE_FRAMES = 48;
const FEATURE_DIM = 80;

export async function createZipformer({ modelPath, tokensPath }) {
  const session = await ort.InferenceSession.create(modelPath);
  const { symbols, blankId, inventory } = parseTokenTable(
    await readFile(tokensPath, "utf8"),
  );

  // Every input but the audio and the frame counter is a cache tensor whose
  // shape the model declares, so nothing here is reconstructed by hand.
  const stateNames = session.inputNames.filter(
    (name) => name !== "x" && name !== "processed_lens",
  );
  const stateShapes = new Map(
    (session.inputMetadata ?? [])
      .filter((meta) => stateNames.includes(meta.name))
      .map((meta) => [
        meta.name,
        meta.shape.map((dim) => (typeof dim === "number" ? dim : 1)),
      ]),
  );

  const freshStates = () => {
    const states = {};
    for (const name of stateNames) {
      const dims = stateShapes.get(name);
      const size = dims.reduce((a, b) => a * b, 1);
      states[name] = new ort.Tensor("float32", new Float32Array(size), dims);
    }
    states.processed_lens = new ort.Tensor(
      "int64",
      new BigInt64Array([0n]),
      [1],
    );
    return states;
  };

  /**
   * The raw frame log-probabilities, for scoring against an expected
   * sequence rather than decoding freely. Same streaming loop; nothing is
   * collapsed or thrown away.
   */
  async function logProbsFor(samples, sampleRate = 16000) {
    const { features, frameCount } = computeFbank(samples, sampleRate);
    const states = freshStates();
    const chunks = [];
    let frames = 0;
    let vocab = 0;

    for (
      let start = 0;
      start + WINDOW_FRAMES <= frameCount;
      start += ADVANCE_FRAMES
    ) {
      const window = features.subarray(
        start * FEATURE_DIM,
        (start + WINDOW_FRAMES) * FEATURE_DIM,
      );
      const outputs = await session.run({
        ...states,
        x: new ort.Tensor("float32", window.slice(), [
          1,
          WINDOW_FRAMES,
          FEATURE_DIM,
        ]),
      });
      for (const name of stateNames) states[name] = outputs[`new_${name}`];
      states.processed_lens = outputs.new_processed_lens;

      const [, steps, width] = outputs.log_probs.dims;
      vocab = width;
      frames += steps;
      chunks.push(outputs.log_probs.data);
    }

    const flat = new Float32Array(frames * vocab);
    let at = 0;
    for (const chunk of chunks) {
      flat.set(chunk, at);
      at += chunk.length;
    }
    return { logProbs: flat, frames, vocab };
  }

  async function recognise(samples, sampleRate = 16000) {
    const { features, frameCount } = computeFbank(samples, sampleRate);
    const states = freshStates();
    const stream = createCtcStreamState();
    const units = [];

    for (
      let start = 0;
      start + WINDOW_FRAMES <= frameCount;
      start += ADVANCE_FRAMES
    ) {
      const window = features.subarray(
        start * FEATURE_DIM,
        (start + WINDOW_FRAMES) * FEATURE_DIM,
      );
      const outputs = await session.run({
        ...states,
        x: new ort.Tensor("float32", window.slice(), [
          1,
          WINDOW_FRAMES,
          FEATURE_DIM,
        ]),
      });

      for (const name of stateNames) states[name] = outputs[`new_${name}`];
      states.processed_lens = outputs.new_processed_lens;

      const [, steps, vocab] = outputs.log_probs.dims;
      units.push(
        ...decodeChunk(
          outputs.log_probs.data,
          steps,
          vocab,
          symbols,
          blankId,
          stream,
        ),
      );
    }

    return { units, frameCount };
  }

  return { recognise, logProbsFor, symbols, blankId, inventory };
}
