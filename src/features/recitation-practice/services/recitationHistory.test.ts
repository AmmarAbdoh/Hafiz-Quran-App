// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteAllRecitations,
  deleteRecitation,
  exportRecitation,
  KEEP_RECITATIONS,
  listRecitations,
  recitationAudio,
  saveRecitation,
  type SavedRecitation,
  updateRecitationFeedback,
} from "./recitationHistory";

/** Cache API over a Map, as in the reader's download tests. */
class FakeCache {
  readonly store = new Map<string, Blob>();

  match(url: string) {
    const body = this.store.get(url);
    return Promise.resolve(body ? new Response(body) : undefined);
  }

  async put(url: string, response: Response) {
    this.store.set(url, await response.blob());
  }

  delete(url: string) {
    return Promise.resolve(this.store.delete(url));
  }
}

let cache: FakeCache;

beforeEach(() => {
  localStorage.clear();
  cache = new FakeCache();
  vi.stubGlobal("caches", {
    open: () => Promise.resolve(cache),
    delete: () => {
      cache.store.clear();
      return Promise.resolve(true);
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function entry(minute: number): SavedRecitation {
  const recordedAt = `2026-10-30T10:${String(minute).padStart(2, "0")}:00.000Z`;
  return {
    id: recordedAt,
    recordedAt,
    from: "2:1",
    to: "2:5",
    seconds: 42,
    bytes: 1000,
    progressIndex: 30,
    totalWords: 30,
    stoppedShort: false,
    words: [
      {
        location: "2:2:3",
        verseKey: "2:2",
        text: "لَا",
        heard: { kind: "nothing" },
        moment: { from: 3.2, to: 3.9 },
      },
    ],
  };
}

/* A recording's audio, as far as these tests can tell one apart. */
const audio = (text: string) => new Blob([text], { type: "audio/wav" });

describe("recitations kept on this device", () => {
  it("lists what was saved, newest first, and plays it back", async () => {
    await saveRecitation(entry(1), audio("first"));
    await saveRecitation(entry(2), audio("second"));

    expect(listRecitations().map((saved) => saved.id)).toEqual([
      entry(2).id,
      entry(1).id,
    ]);
    expect(listRecitations()[0]!.words[0]!.moment).toEqual({
      from: 3.2,
      to: 3.9,
    });
    const played = await recitationAudio(entry(1).id);
    /* Present, not compared: jsdom stringifies a Blob put into a Response. */
    expect(played).not.toBeNull();
  });

  it("keeps only the most recent, and lets the oldest audio go too", async () => {
    for (let minute = 0; minute <= KEEP_RECITATIONS; minute += 1) {
      await saveRecitation(entry(minute), audio(`run ${minute}`));
    }

    const kept = listRecitations();
    expect(kept).toHaveLength(KEEP_RECITATIONS);
    expect(kept.some((saved) => saved.id === entry(0).id)).toBe(false);
    expect(await recitationAudio(entry(0).id)).toBeNull();
    expect(cache.store.size).toBe(KEEP_RECITATIONS);
  });

  it("forgets one recording, or all of them", async () => {
    await saveRecitation(entry(1), audio("first"));
    await saveRecitation(entry(2), audio("second"));

    await deleteRecitation(entry(1).id);
    expect(listRecitations().map((saved) => saved.id)).toEqual([entry(2).id]);
    expect(await recitationAudio(entry(1).id)).toBeNull();

    await deleteAllRecitations();
    expect(listRecitations()).toEqual([]);
    expect(cache.store.size).toBe(0);
  });

  /* Storage the reader cannot see into must not take the list down with it. */
  it("reads a damaged list as empty rather than failing", () => {
    localStorage.setItem("artqiy.recitations.v1", "{not json");
    expect(listRecitations()).toEqual([]);

    localStorage.setItem(
      "artqiy.recitations.v1",
      JSON.stringify([{ id: 1 }, entry(3)]),
    );
    expect(listRecitations().map((saved) => saved.id)).toEqual([entry(3).id]);
  });

  it("says so when there is nowhere to keep the audio", async () => {
    vi.stubGlobal("caches", undefined);

    await expect(saveRecitation(entry(1), audio("x"))).rejects.toThrow(
      "Cache storage is unavailable",
    );
    expect(listRecitations()).toEqual([]);
  });
});

/* jsdom's Blob has no text(); FileReader is what it does have. */
const readText = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

describe("the reader's word on a kept recitation", () => {
  it("is stored with the entry it describes", async () => {
    await saveRecitation(entry(1), new Blob(["wav"]));
    updateRecitationFeedback(entry(1).id, () => ({
      words: { "1:1:1": "mistake" },
      missedMistake: false,
    }));

    expect(listRecitations()[0]!.feedback).toEqual({
      words: { "1:1:1": "mistake" },
      missedMistake: false,
    });
  });

  /* Only worth having beside the audio it describes. */
  it("is dropped for a recitation no longer kept", () => {
    expect(
      updateRecitationFeedback("gone", () => ({
        words: {},
        missedMistake: true,
      })),
    ).toBeNull();
    expect(listRecitations()).toEqual([]);
  });

  /* The summary and settings answer for the same run; neither may write
     back over an answer the other gave. */
  it("changes the stored answers, not an earlier copy of them", async () => {
    await saveRecitation(entry(1), new Blob(["wav"]));
    updateRecitationFeedback(entry(1).id, (current) => ({
      ...current,
      missedMistake: true,
    }));
    updateRecitationFeedback(entry(1).id, (current) => ({
      ...current,
      words: { ...current.words, "2:1:1": "saidRight" },
    }));

    expect(listRecitations()[0]!.feedback).toEqual({
      words: { "2:1:1": "saidRight" },
      missedMistake: true,
    });
  });

  it("is dropped, keeping the recording, when it does not parse", () => {
    localStorage.setItem(
      "artqiy.recitations.v1",
      JSON.stringify([{ ...entry(1), feedback: { missedMistake: true } }]),
    );

    expect(listRecitations()).toHaveLength(1);
    expect(listRecitations()[0]!.feedback).toBeUndefined();
  });

  it("is exported with the audio, whole, in one file", async () => {
    const audio = new Uint8Array(70_000).map((_, i) => i % 251);
    const wav = new Blob([audio]);
    await saveRecitation(entry(1), wav);
    /* Node's Response turns jsdom's Blob into "[object Blob]"; the real
       Cache API returns the bytes, so hand them back as they went in. */
    vi.spyOn(cache, "match").mockResolvedValue(new Response(audio));
    updateRecitationFeedback(entry(1).id, () => ({
      words: {},
      missedMistake: true,
    }));

    const file = await exportRecitation(entry(1).id);
    const parsed = JSON.parse(await readText(file!)) as {
      format: string;
      recitation: SavedRecitation;
      audio: { base64: string };
    };

    expect(parsed.format).toBe("artqiy-recitation");
    expect(parsed.recitation.feedback?.missedMistake).toBe(true);
    expect(
      Uint8Array.from(atob(parsed.audio.base64), (c) => c.charCodeAt(0)),
    ).toEqual(audio);
  });

  it("exports nothing once the audio is gone", async () => {
    await saveRecitation(entry(1), new Blob(["wav"]));
    cache.store.clear();

    expect(await exportRecitation(entry(1).id)).toBeNull();
  });
});
