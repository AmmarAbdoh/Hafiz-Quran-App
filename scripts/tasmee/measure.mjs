/*
 * Fill both caches, in parallel, in one pass.
 *
 * This replaces the model half of `cursor.mjs` and `sweep.mjs`, which each
 * walked every clip on one core: two full passes, about ninety minutes for
 * 3,595 clips, with nine of ten cores idle.
 *
 * Two things make it faster. Clips are independent, so they go to a pool of
 * child processes - this machine has ten physical cores and the bench used
 * one. And the alignment and the cursor's phonemes come from the *same*
 * forward pass rather than two, because the greedy decode is an argmax over
 * the frames the aligner already needs.
 *
 * The GPU is not the answer here and was measured, not assumed: see
 * `providers.mjs`. DirectML crashes on this graph and WebGPU runs 180x slower
 * than the CPU, because a streaming model is hundreds of tiny sequential
 * calls carrying 99 cache tensors each - per-call overhead, not arithmetic.
 *
 * Writes the same two cache files the existing scripts read, so `cursor.mjs`,
 * `sweep.mjs` and `skips.mjs` need no changes and still work alone.
 *
 *   node scripts/tasmee/measure.mjs [--fixtures DIR] [--workers 8]
 */
import { flag } from "./lib/args.mjs";
import { fork } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { availableParallelism, constants, setPriority } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKER = fileURLToPath(new URL("./lib/clipWorker.mjs", import.meta.url));

/**
 * One child per physical core, less one for the parent and the OS.
 *
 * Each child holds its own copy of the model, so this is memory as well as
 * CPU: eight children is about 0.6GB of weights plus the runtime's arenas.
 */
function defaultWorkers() {
  return Math.max(1, Math.min(8, Math.floor(availableParallelism() / 2)));
}

/**
 * Step the workers down the scheduler's queue.
 *
 * This runs on somebody's own machine, for an hour at a time, and saturating
 * every core makes the rest of it unusable - which it did, during a game.
 * Below-normal priority costs the bench almost nothing when the machine is
 * idle and gives the cores straight back when it is not.
 */
function beNice(child) {
  try {
    setPriority(child.pid, constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {
    /* Not permitted on every platform; the run matters more than the niceness. */
  }
}

/** Hand clips out one at a time, so a long ayah blocks nobody. */
function runPool(clips, fixtures, workerCount, onProgress, nice) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let next = 0;
    let live = 0;
    /* Clips finished, however they finished: progress, not successes. */
    let done = 0;

    const children = Array.from({ length: workerCount }, () => fork(WORKER));

    const give = (child) => {
      if (next >= clips.length) {
        child.send({ type: "done" });
        child.disconnect();
        live -= 1;
        if (live === 0) resolve(rows);
        return;
      }
      const clip = clips[next];
      next += 1;
      child.send({ type: "clip", clip, fixtures });
    };

    for (const child of children) {
      live += 1;
      if (nice) beNice(child);
      child.on("message", (message) => {
        if (message.type === "ready") {
          give(child);
          return;
        }
        if (message.type === "row") {
          if (message.row.failed) {
            console.log(`  ${message.row.id}: ${message.row.failed}`);
          } else if (!message.row.skipped) {
            rows.push(message.row);
          }
          done += 1;
          onProgress(done);
          give(child);
        }
      });
      child.on("error", reject);
      child.send({ type: "load" });
    }
  });
}

async function main() {
  const fixtures = path.resolve(
    flag("fixtures", "scripts/tasmee/fixtures-large"),
  );
  const workerCount = Number(flag("workers", String(defaultWorkers())));
  const nice = flag("nice", "1") !== "0";
  const manifest = JSON.parse(
    await readFile(path.join(fixtures, "manifest.json"), "utf8"),
  );

  console.log(
    `${manifest.clips.length} clips across ${workerCount} workers ` +
      `(${availableParallelism()} logical cores)` +
      `${nice ? ", below-normal priority" : ""}…`,
  );

  const started = Date.now();
  /* Twenty updates whatever the size of the set, not one every 200 clips. */
  const every = Math.max(1, Math.round(manifest.clips.length / 20));
  let lastShown = 0;
  const rows = await runPool(
    manifest.clips,
    fixtures,
    workerCount,
    (done) => {
      if (done - lastShown < every && done < manifest.clips.length) return;
      lastShown = done;
      const elapsed = (Date.now() - started) / 1000;
      const rate = done / elapsed;
      const left = Math.round((manifest.clips.length - done) / rate / 60);
      console.log(
        `  ${done}/${manifest.clips.length} · ${rate.toFixed(1)}/s · ~${left} min left`,
      );
    },
    nice,
  );

  /* The two cache shapes the existing scripts already read. */
  await writeFile(
    path.join(fixtures, ".emissions.json"),
    JSON.stringify(
      rows.map(({ id, kind, verdict, reciter, verseKeys, units }) => ({
        id,
        kind,
        verdict,
        reciter,
        verseKeys,
        units,
      })),
    ),
    "utf8",
  );
  await writeFile(
    path.join(fixtures, ".scores.json"),
    JSON.stringify(
      rows.map(
        ({
          id,
          kind,
          verdict,
          reciter,
          span,
          totalWords,
          scores,
          supports,
        }) => ({
          id,
          kind,
          verdict,
          reciter,
          /* The scores cover `span` of `totalWords`, because the app only
             scores the stretch the reciter reached. */
          span,
          totalWords,
          scores,
          supports,
        }),
      ),
    ),
    "utf8",
  );

  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(
    `\n${rows.length} clips measured in ${minutes} min. ` +
      `Both caches written; cursor.mjs, sweep.mjs and skips.mjs will read them.`,
  );
}

await main();
