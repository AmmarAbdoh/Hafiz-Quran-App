// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import type { SavedRecitation } from "@/features/recitation-practice/services/recitationHistory";
import { RecitationHistory } from "./RecitationHistory";

const saved: SavedRecitation = {
  id: "2026-10-30T10:00:00.000Z",
  recordedAt: "2026-10-30T10:00:00.000Z",
  from: "2:1",
  to: "2:5",
  seconds: 65,
  bytes: 1000,
  progressIndex: 30,
  totalWords: 30,
  stoppedShort: false,
  words: [
    {
      location: "2:2:3",
      verseKey: "2:2",
      text: "رَيْبَ",
      heard: { kind: "nothing" },
      moment: { from: 3, to: 4 },
    },
  ],
};

const store = new Map<string, Blob>();

beforeEach(() => {
  /* jsdom has no media playback; the player pauses when it goes away. */
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  localStorage.clear();
  store.clear();
  localStorage.setItem("artqiy.recitations.v1", JSON.stringify([saved]));
  store.set(`/__artqiy/recitations/${saved.id}`, new Blob(["wav"]));
  vi.stubGlobal("caches", {
    open: () =>
      Promise.resolve({
        match: (url: string) =>
          Promise.resolve(
            store.has(url) ? new Response(store.get(url)) : undefined,
          ),
        delete: (url: string) => Promise.resolve(store.delete(url)),
      }),
    delete: () => {
      store.clear();
      return Promise.resolve(true);
    },
  });
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => "blob:saved",
    revokeObjectURL: () => undefined,
  });
});

afterEach(() => vi.unstubAllGlobals());

const renderHistory = () =>
  render(
    <LocaleProvider>
      <RecitationHistory />
    </LocaleProvider>,
  );

describe("recordings kept on this device", () => {
  it("lists each run by its ayat, length, and what to review", () => {
    renderHistory();

    expect(screen.getByText("البقرة ١–٥")).toBeInTheDocument();
    expect(screen.getByText("١:٠٥")).toBeInTheDocument();
    expect(screen.getByText("للمراجعة: ١")).toBeInTheDocument();
  });

  it("plays a run, and a listed word in it", async () => {
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    renderHistory();

    fireEvent.click(screen.getByRole("button", { name: "استمع" }));
    expect(
      await screen.findByRole("slider", { name: "البقرة ١–٥" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "استمع إلى «رَيْبَ»" }));
    expect(play).toHaveBeenCalledOnce();
    play.mockRestore();
  });

  it("says so when the browser no longer has the audio", async () => {
    store.clear();
    renderHistory();

    fireEvent.click(screen.getByRole("button", { name: "استمع" }));
    expect(
      await screen.findByText("لم يعد هذا التسجيل موجودًا على الجهاز."),
    ).toBeInTheDocument();
  });

  it("deletes a run", async () => {
    renderHistory();

    fireEvent.click(
      screen.getByRole("button", { name: "احذف تسجيل البقرة ١–٥" }),
    );
    expect(
      await screen.findByText("لا توجد تسجيلات بعد. سيظهر هنا تسميعك القادم."),
    ).toBeInTheDocument();
    expect(store.size).toBe(0);
  });

  it("keeps the reader's word on a listed word and on what was missed", async () => {
    renderHistory();

    fireEvent.click(screen.getByRole("button", { name: "استمع" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "قرأتها صحيحة: «رَيْبَ»" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "أخطأت في كلمة لم تُذكر هنا" }),
    );

    expect(
      (
        JSON.parse(
          localStorage.getItem("artqiy.recitations.v1")!,
        ) as SavedRecitation[]
      )[0]!.feedback,
    ).toEqual({ words: { "2:2:3": "saidRight" }, missedMistake: true });
    expect(
      screen.getByRole("button", { name: "قرأتها صحيحة: «رَيْبَ»" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("exports a run as one file the reader can share", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    renderHistory();

    fireEvent.click(
      screen.getByRole("button", {
        name: "صدّر تسجيل البقرة ١–٥ مع إجاباتك",
      }),
    );

    await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      "artqiy-recitation-2026-10-30T10-00-00-000Z.json",
    );
    click.mockRestore();
  });

  it("says so when there is no audio left to export", async () => {
    store.clear();
    renderHistory();

    fireEvent.click(
      screen.getByRole("button", {
        name: "صدّر تسجيل البقرة ١–٥ مع إجاباتك",
      }),
    );
    expect(
      await screen.findByText("لم يعد هذا التسجيل موجودًا على الجهاز."),
    ).toBeInTheDocument();
  });

  it("remembers when the reader stops keeping recordings", () => {
    renderHistory();

    fireEvent.click(
      screen.getByRole("switch", { name: "احتفظ بتسجيلات التسميع" }),
    );
    expect(localStorage.getItem("quran-practice-keep-recordings")).toBe(
      "false",
    );
  });
});
