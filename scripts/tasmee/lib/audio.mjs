import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/** What every ASR candidate here expects: 16kHz, mono, 16-bit PCM. */
export const SAMPLE_RATE = 16000;

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function ffprobeDuration(file) {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    file,
  ]);
  return Number.parseFloat(stdout.trim());
}

export async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  await ensureDir(path.dirname(destination));
  await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  return destination;
}

/** Decode anything to the one format the runners take. */
export async function toWav(source, destination) {
  await ensureDir(path.dirname(destination));
  await run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    source,
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-sample_fmt",
    "s16",
    destination,
  ]);
  return destination;
}

/** A slice of one file, by seconds. */
export async function cut(source, destination, start, duration) {
  await ensureDir(path.dirname(destination));
  const args = ["-y", "-loglevel", "error", "-i", source, "-ss", String(start)];
  if (duration !== undefined) args.push("-t", String(duration));
  args.push(
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-sample_fmt",
    "s16",
    destination,
  );
  await run("ffmpeg", args);
  return destination;
}

/** Join clips end to end. They must already share a format. */
export async function concat(sources, destination) {
  await ensureDir(path.dirname(destination));
  const args = ["-y", "-loglevel", "error"];
  for (const source of sources) args.push("-i", source);
  args.push(
    "-filter_complex",
    `${sources.map((_, index) => `[${index}:a]`).join("")}concat=n=${sources.length}:v=0:a=1[out]`,
    "-map",
    "[out]",
    "-ac",
    "1",
    "-ar",
    String(SAMPLE_RATE),
    "-sample_fmt",
    "s16",
    destination,
  );
  await run("ffmpeg", args);
  return destination;
}

export async function silence(destination, seconds) {
  await ensureDir(path.dirname(destination));
  await run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
    "-t",
    String(seconds),
    "-sample_fmt",
    "s16",
    destination,
  ]);
  return destination;
}

/** 16-bit PCM WAV to the Float32 mono a model wants. */
export async function readWavAsFloat32(file) {
  const { readFile } = await import("node:fs/promises");
  const buffer = await readFile(file);

  // Walk the RIFF chunks rather than assuming a 44-byte header; ffmpeg emits
  // a LIST chunk that makes that assumption produce noise.
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "data") {
      const samples = new Float32Array(size / 2);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = buffer.readInt16LE(offset + 8 + index * 2) / 32768;
      }
      return samples;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`No data chunk in ${file}`);
}
