/*
 * Is the GPU any use to us?
 *
 * The obvious answer is yes and the likely answer is no, because of the shape
 * of this particular workload rather than anything about the hardware. The
 * recogniser is a *streaming* model: it is handed 61 frames at a time and
 * carries 99 cache tensors from one call to the next, so a clip is hundreds
 * of tiny sequential inferences, each depending on the last. Nothing can be
 * batched inside a clip, and every call would have to ship those 99 state
 * tensors across to the device and back. Per-call overhead, not arithmetic,
 * is what this costs.
 *
 * On top of that the weights we use are int8. Quantised kernels are where
 * CPU inference is strongest and where GPU providers are weakest - ops that
 * are not supported get placed back on the CPU, which adds transfers without
 * removing work.
 *
 * So this measures it instead of arguing about it. Same model, same window,
 * same state handling as the real loop; only the execution provider changes.
 *
 * Each provider is timed in a child process, because DirectML does not fail
 * politely on this model - it takes the process down with it, with no
 * JavaScript error to catch. A crashed child is a result ("unavailable"),
 * not the end of the run.
 *
 *   node scripts/tasmee/providers.mjs [--windows 120]
 */
import { flag } from "./lib/args.mjs";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import ort from "onnxruntime-node";

const MODEL_DIR = process.env.TASMEE_ZIPFORMER_DIR ?? ".models/zipformer";
const MODEL = `${MODEL_DIR}/zipformer_p_arabic_v3.1.int8.onnx`;

/** The model's own metadata: 61 frames in, 80 features, advancing 48. */
const WINDOW_FRAMES = 61;
const FEATURE_DIM = 80;

async function bench(provider, windows) {
  let session;
  try {
    session = await ort.InferenceSession.create(MODEL, {
      executionProviders: [provider],
    });
  } catch (error) {
    return { provider, error: String(error?.message ?? error).slice(0, 140) };
  }

  const stateNames = session.inputNames.filter(
    (name) => name !== "x" && name !== "processed_lens",
  );
  const shapes = new Map(
    (session.inputMetadata ?? [])
      .filter((meta) => "shape" in meta && stateNames.includes(meta.name))
      .map((meta) => [
        meta.name,
        meta.shape.map((dim) => (typeof dim === "number" ? dim : 1)),
      ]),
  );

  const freshStates = () => {
    const states = {};
    for (const name of stateNames) {
      const dims = shapes.get(name);
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

  const frame = new Float32Array(WINDOW_FRAMES * FEATURE_DIM).fill(0.1);
  const step = async (states) => {
    const outputs = await session.run({
      ...states,
      x: new ort.Tensor("float32", frame.slice(), [
        1,
        WINDOW_FRAMES,
        FEATURE_DIM,
      ]),
    });
    const next = {};
    for (const name of stateNames) next[name] = outputs[`new_${name}`];
    next.processed_lens = outputs.new_processed_lens;
    return next;
  };

  // Warm up, so shader compilation and allocation are not what gets timed.
  let states = freshStates();
  for (let i = 0; i < 5; i += 1) states = await step(states);

  states = freshStates();
  const started = performance.now();
  for (let i = 0; i < windows; i += 1) states = await step(states);
  const ms = performance.now() - started;

  await session.release();
  return { provider, ms, perWindow: ms / windows };
}

/** Time one provider in a child, so a native crash is survivable. */
function benchInChild(provider, windows) {
  return new Promise((resolve) => {
    const child = fork(fileURLToPath(import.meta.url), [
      "--only",
      provider,
      "--windows",
      String(windows),
    ]);
    let result = null;
    child.on("message", (message) => {
      result = message;
    });
    child.on("exit", (code) => {
      if (result) resolve(result);
      else resolve({ provider, error: `the process exited with code ${code}` });
    });
    child.on("error", (error) => {
      resolve({ provider, error: String(error.message).slice(0, 140) });
    });
  });
}

async function main() {
  const windows = Number(flag("windows", "120"));
  const only = flag("only", null);

  /* Child mode: time the one provider and post the result back. */
  if (only) {
    const result = await bench(only, windows);
    process.send?.(result);
    return;
  }

  /* 48 frames advanced per window at 10ms a frame. */
  const seconds = ((windows * 48 * 10) / 1000).toFixed(1);
  console.log(
    `${windows} windows (~${seconds}s of audio) per provider, after warm-up\n`,
  );

  const results = [];
  for (const provider of ["cpu", "dml", "webgpu"]) {
    const result = await benchInChild(provider, windows);
    if (result.error) {
      console.log(`  ${provider.padEnd(7)} unavailable: ${result.error}`);
      continue;
    }
    results.push(result);
    console.log(
      `  ${result.provider.padEnd(7)} ${String(Math.round(result.ms)).padStart(6)}ms  ` +
        `${result.perWindow.toFixed(2)}ms per window  ` +
        `${(Number(seconds) / (result.ms / 1000)).toFixed(1)}x real time`,
    );
  }

  const best = results.reduce((a, b) => (a.ms < b.ms ? a : b), results[0]);
  if (best) {
    console.log(`\nFastest: ${best.provider}.`);
    const cpu = results.find((result) => result.provider === "cpu");
    if (cpu && best !== cpu) {
      console.log(
        `That is ${(cpu.ms / best.ms).toFixed(2)}x the CPU, so it is worth ` +
          `wiring a provider option through lib/zipformer.mjs.`,
      );
    } else if (cpu) {
      console.log(
        "The CPU wins, which is the expected answer for hundreds of tiny\n" +
          "sequential calls with 99 state tensors each. Spend the effort on\n" +
          "running clips in parallel instead - they are independent, and this\n" +
          "machine has cores sitting idle.",
      );
    }
  }
}

await main();
