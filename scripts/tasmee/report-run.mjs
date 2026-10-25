/*
 * A saved تسميع run, written out for a person to read.
 *
 * The JSON beside every recording has everything - each phoneme the
 * recogniser emitted, where the cursor went and when, what the verdict said -
 * and none of it is readable as it stands. Working out why a run went wrong
 * meant scripting the same questions every time: where did it stall, what
 * was it waiting for, what did it hear instead. This answers them once, in
 * Markdown beside the recording.
 *
 * Development only, like the recordings. The dev server writes one on every
 * save; for a run saved before that, or after changing this:
 *
 *   node scripts/tasmee/report-run.mjs scripts/tasmee/fixtures/recorded/recorded-*.json
 *
 * Runs saved before events were captured have no timeline. For those the
 * cursor is replayed over the recorded phonemes with the app's own tracker,
 * which puts it on the audio's clock - but cannot press the buttons the
 * reciter pressed, so where they gave up on a word or turned stop-on-mistake
 * off, the replay and the run part ways. Those reports say so.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** A gap this long between phonemes is a breath, for the heard stream. */
const PAUSE_SECONDS = 0.6;
/** Standing on a word longer than this is listed under "where it stalled". */
const STALL_SECONDS = 3;
/** Below this the recogniser was guessing; marked in the heard stream. */
const UNSURE = 0.6;
/** Runner-ups at least this likely are shown beside the sound that won. */
const RUNNER_UP_SHOWN = 0.15;

const seconds = (value) => `${value.toFixed(1)}s`;
const join = (units) => units.join("");
const cell = (text) => String(text ?? "").replaceAll("|", "\\|") || "—";

/** How often the worker posts phonemes: 48 fbank frames at a 10ms shift. */
const CHUNK_SECONDS = 48 * 0.01;

/** Where the cursor stood, from the run's own events: [location, from, to]. */
function recordedIntervals(meta, end) {
  const intervals = [];
  let at = meta.expected[0]?.locations[0] ?? null;
  let since = 0;
  for (const move of meta.events.filter((event) => event.kind === "cursor")) {
    if (at) intervals.push([at, since, move.t]);
    at = move.to;
    since = move.t;
  }
  if (at) intervals.push([at, since, end]);
  return intervals;
}

/**
 * Where the cursor would have stood, replaying the tracker over the heard
 * phonemes in the worker's own batches - holding at each stumble, as the app
 * does with stop-on-mistake on, when `hold` is set.
 */
async function replayedIntervals(meta, end, hold) {
  const { advanceTracker, createPhonemeTracker, holdAt } =
    await import("../../src/features/recitation-practice/model/phonemeProgress.ts");
  const tracker = createPhonemeTracker(meta.expected);
  const label = (index) => meta.expected[index]?.locations[0] ?? null;
  const intervals = [];
  let at = 0;
  let since = 0;
  let batch = [];
  let batchEnd = CHUNK_SECONDS;
  const post = () => {
    const progress = advanceTracker(tracker, batch);
    const stumble = progress.stumbles.at(-1);
    if (
      hold &&
      stumble &&
      progress.wordIndex <= stumble.wordIndex &&
      progress.heldAt === null
    ) {
      holdAt(tracker, stumble.wordIndex);
    }
    if (progress.wordIndex !== at) {
      if (label(at)) intervals.push([label(at), since, batchEnd]);
      at = progress.wordIndex;
      since = batchEnd;
    }
    batch = [];
  };
  for (const [symbol, confidence, seconds, runnersUp] of meta.heard) {
    while (seconds >= batchEnd) {
      post();
      batchEnd += CHUNK_SECONDS;
    }
    batch.push({
      symbol,
      confidence,
      seconds,
      alternatives: runnersUp?.map(([other, probability]) => ({
        symbol: other,
        probability,
      })),
    });
  }
  post();
  if (label(at)) intervals.push([label(at), since, end]);
  return intervals;
}

/** The page's own text for each word, for runs saved before it was kept. */
async function withWordText(meta) {
  if (meta.expected.every((word) => word.text)) return meta;
  const { getVerse } = await import("./lib/quranText.mjs");
  const verses = new Map();
  const textOf = async (location) => {
    const [surah, ayah, position] = location.split(":").map(Number);
    const key = `${surah}:${ayah}`;
    if (!verses.has(key)) {
      /* Uthmani: one token per page word, then the ayah's end mark. */
      const verse = await getVerse(surah, ayah);
      verses.set(key, verse.aya_text.split(/\s+/).filter(Boolean));
    }
    return verses.get(key)[position - 1] ?? "";
  };
  const expected = [];
  for (const word of meta.expected) {
    const text = [];
    for (const location of word.locations) text.push(await textOf(location));
    expected.push({ ...word, text: text.join(" ") });
  }
  return { ...meta, expected };
}

function heardBetween(meta, from, to) {
  return meta.heard
    .filter(([, , t]) => t >= from && t < to)
    .map(([symbol]) => symbol);
}

function describeHeard(heard) {
  if (!heard) return "";
  switch (heard.kind) {
    case "gaveUp":
      return "gave up on it";
    case "stumble":
      return `stumbled first, heard ${heard.letters}`;
    case "other":
      return `heard ${heard.letters}`;
    case "unclear":
      return "scored weak, nothing clearer heard";
    default:
      return heard.kind;
  }
}

function describeEvent(event, textOf) {
  const word = (location) =>
    location ? `${location} ${textOf.get(location) ?? ""}`.trim() : "end";
  switch (event.kind) {
    case "cursor":
      return `cursor ${word(event.from)} → ${word(event.to)}`;
    case "stumble":
      return `**stumble** at ${word(event.location)}: heard ${join(event.heard)}`;
    case "passed-over":
      return `passed over ${event.locations.map(word).join("، ")}`;
    case "hold":
      return `**held** at ${word(event.location)}`;
    case "release":
      return `released ${word(event.location)}`;
    case "reveal":
      return `revealed ${event.locations.map(word).join("، ")}`;
    case "gave-up":
      return `**gave up** on ${event.locations.map(word).join("، ")}`;
    case "stop-on-mistake":
      return `stop-on-mistake turned ${event.on ? "on" : "off"}`;
    case "page":
      return `**next page**, from ${word(event.location)}`;
    case "stop":
      return "stopped";
    default:
      return JSON.stringify(event);
  }
}

/**
 * The report, as Markdown. `intervals` is where the cursor stood and when;
 * without it the run's recorded events are used.
 */
export function renderRunReport(meta, name = "run", intervals = null) {
  const end = meta.heard.at(-1)?.[2] ?? 0;
  const textOf = new Map();
  const unitsOf = new Map();
  for (const word of meta.expected) {
    for (const location of word.locations) {
      if (word.text) textOf.set(location, word.text);
      unitsOf.set(location, word.units);
    }
  }
  const misread = new Set(meta.misreadLocations);
  const passedOver = new Set(meta.skippedLocations);
  const heardAt = new Map(
    (meta.misreadHeard ?? []).map((entry) => [entry.location, entry.heard]),
  );
  const stumbledAt = new Map(
    /* The first two runs predate stumbles being kept. */
    (meta.stumbles ?? []).map((entry) => [entry.location, entry.heard]),
  );

  const approximate = !meta.events;
  intervals ??= recordedIntervals(meta, end);
  const timeOn = new Map();
  const heardOn = new Map();
  for (const [location, from, to] of intervals) {
    timeOn.set(location, (timeOn.get(location) ?? 0) + (to - from));
    const heard = heardBetween(meta, from, to);
    if (heard.length > 0) {
      heardOn.set(location, [...(heardOn.get(location) ?? []), join(heard)]);
    }
  }

  const unsure = meta.heard.filter(([, confidence]) => confidence < UNSURE);
  const events = meta.events ?? [];
  const holds = events.filter((event) => event.kind === "hold").length;
  const waits = [...timeOn.values()];
  const stalls = [...timeOn]
    .filter(([, time]) => time >= STALL_SECONDS)
    .sort((a, b) => b[1] - a[1]);
  const first = meta.expected[0]?.locations[0] ?? "";
  const last = meta.expected.at(-1)?.locations.at(-1) ?? "";

  const lines = [];
  lines.push(`# تسميع run: ${meta.note || name}`, "");
  lines.push(
    `Recorded ${meta.recordedAt}, ${first} to ${last}, ${seconds(end)} of audio. ` +
      `Stop-on-mistake ${meta.stopOnMistake === undefined ? "not recorded" : meta.stopOnMistake ? "on" : "off"} at the start; ` +
      `strict mode ${meta.strictMode ? "on" : "off"}.`,
    "",
  );
  if (approximate) {
    lines.push(
      "> Saved before runs recorded their events, so there is no timeline. Where the cursor stood is a replay of the tracker over the recorded phonemes: on the audio's clock, but blind to any button the reciter pressed - giving up on a word, turning stop-on-mistake off - and it parts ways with the run from there." +
        (meta.replayedWith
          ? ` Replayed with ${meta.replayedWith}, which waited where the run recorded waiting more closely than the other way.`
          : ""),
      "",
    );
  }

  lines.push("## Numbers", "", "| | |", "|---|---|");
  const row = (label, value) => lines.push(`| ${label} | ${value} |`);
  row(
    "Words recited / on the pages",
    `${meta.progressIndex} / ${meta.totalWords}`,
  );
  row("Stopped short", meta.stoppedShort ? "yes" : "no");
  row("Marked for review", meta.misreadLocations.length);
  row("Passed over by the cursor", meta.skippedLocations.length);
  row("Stumbles", meta.stumbles?.length ?? "not recorded");
  if (meta.events) row("Holds (stop-on-mistake)", holds);
  row(
    `Words waited on ${STALL_SECONDS}s or more`,
    `${stalls.length}, longest ${seconds(Math.max(0, ...waits))}`,
  );
  row("Phonemes heard", meta.heard.length);
  row(
    `Heard with confidence under ${UNSURE}`,
    `${unsure.length} (${meta.heard.length ? Math.round((100 * unsure.length) / meta.heard.length) : 0}%)`,
  );
  lines.push("");

  lines.push(
    "## Where it stalled",
    "",
    "What the cursor was waiting for, against what the recogniser heard while it waited. A word said right and still waited on is the recogniser mishearing it; a word the heard column does not resemble is the reciter elsewhere.",
    "",
  );
  if (stalls.length === 0) {
    lines.push("Nowhere for more than " + seconds(STALL_SECONDS) + ".", "");
  } else {
    lines.push(
      "| word | waited | wanted | heard while waiting |",
      "|---|---|---|---|",
    );
    for (const [location, time] of stalls) {
      lines.push(
        `| ${location} ${cell(textOf.get(location))} | ${seconds(time)} | ${cell(join(unitsOf.get(location) ?? []))} | ${cell((heardOn.get(location) ?? []).join(" / "))} |`,
      );
    }
    lines.push("");
  }

  if (events.length > 0) {
    lines.push(
      "## Timeline",
      "",
      "Cursor moves are left out; every other event, at its time in the audio.",
      "",
    );
    for (const event of events) {
      if (event.kind === "cursor") continue;
      lines.push(`- ${seconds(event.t)} ${describeEvent(event, textOf)}`);
    }
    lines.push("");
  }

  lines.push(
    "## Every word",
    "",
    "| word | text | wanted | heard while the cursor was on it | time | result |",
    "|---|---|---|---|---|---|",
  );
  for (const word of meta.expected) {
    const location = word.locations[0];
    const results = [];
    for (const each of word.locations) {
      if (misread.has(each)) {
        results.push(
          `**review**: ${describeHeard(heardAt.get(each)) || "marked"}`,
        );
      }
      if (passedOver.has(each)) results.push("passed over");
      if (stumbledAt.has(each) && !heardAt.has(each)) {
        results.push(`stumbled: ${join(stumbledAt.get(each))}`);
      }
    }
    lines.push(
      `| ${word.locations.join("+")} | ${cell(word.text)} | ${cell(join(word.units))} | ${cell((heardOn.get(location) ?? []).join(" / "))} | ${timeOn.has(location) ? seconds(timeOn.get(location)) : ""} | ${results.length ? [...new Set(results)].join("; ") : "ok"} |`,
    );
  }
  lines.push("");

  lines.push(
    "## Everything heard",
    "",
    `Grouped at pauses of ${PAUSE_SECONDS}s or more; \`?\` marks a phoneme heard with confidence under ${UNSURE}, and a runner-up the recogniser gave ${RUNNER_UP_SHOWN * 100}% or more follows in brackets.`,
    "",
    "```text",
  );
  let group = [];
  let groupStart = null;
  let previous = null;
  const flush = () => {
    if (group.length)
      lines.push(`${seconds(groupStart).padStart(7)}  ${group.join(" ")}`);
    group = [];
  };
  for (const [symbol, confidence, t, runnersUp] of meta.heard) {
    if (previous !== null && t - previous > PAUSE_SECONDS) flush();
    if (group.length === 0) groupStart = t;
    /* A runner-up worth knowing about, as (تَ 28%): the recogniser's doubt,
       which is usually the whole story of a stall on a word said right. */
    const doubt = (runnersUp ?? [])
      .filter(([, probability]) => probability >= RUNNER_UP_SHOWN)
      .map(
        ([other, probability]) => `${other} ${Math.round(probability * 100)}%`,
      );
    group.push(
      (confidence < UNSURE ? `${symbol}?` : symbol) +
        (doubt.length ? `(${doubt.join(", ")})` : ""),
    );
    previous = t;
  }
  flush();
  lines.push("```", "");
  return lines.join("\n");
}

/**
 * How far a replay's waits are from the ones the run recorded, in seconds.
 *
 * Old runs do not say when stop-on-mistake was on - it was usually toggled
 * part way - so both replays are made and the one that waited where the
 * reciter actually waited is kept.
 */
function distanceFromRecorded(meta, intervals) {
  const replayed = new Map();
  for (const [location, from, to] of intervals) {
    replayed.set(location, (replayed.get(location) ?? 0) + to - from);
  }
  const recorded = new Map();
  for (const held of meta.held) {
    const location = held.locations[0];
    recorded.set(location, (recorded.get(location) ?? 0) + held.ms / 1000);
  }
  let distance = 0;
  for (const location of new Set([...replayed.keys(), ...recorded.keys()])) {
    distance += Math.abs(
      (replayed.get(location) ?? 0) - (recorded.get(location) ?? 0),
    );
  }
  return distance;
}

/** Write the report beside a saved run's JSON; returns where it went. */
export async function writeRunReport(jsonPath) {
  const meta = await withWordText(JSON.parse(await readFile(jsonPath, "utf8")));
  const end = meta.heard.at(-1)?.[2] ?? 0;
  let intervals = null;
  if (!meta.events) {
    const [held, free] = await Promise.all([
      replayedIntervals(meta, end, true),
      replayedIntervals(meta, end, false),
    ]);
    const holding =
      distanceFromRecorded(meta, held) < distanceFromRecorded(meta, free);
    intervals = holding ? held : free;
    meta.replayedWith = holding ? "stop-on-mistake on" : "stop-on-mistake off";
  }
  const out = jsonPath.replace(/\.json$/, ".md");
  await writeFile(
    out,
    renderRunReport(meta, path.basename(jsonPath, ".json"), intervals),
    "utf8",
  );
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error(
      "usage: node scripts/tasmee/report-run.mjs <recorded.json>...",
    );
    process.exit(1);
  }
  for (const file of files) console.log(await writeRunReport(file));
}
