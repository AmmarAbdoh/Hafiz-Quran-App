// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import type * as QuranModuleTypes from "@/domain/quran";
import type { MushafVerse } from "@/domain/quran";

type QuranModule = typeof QuranModuleTypes;
import type { AudioIdentifyQuizQuestion } from "../model/types";
import { AudioQuestion } from "./AudioQuestion";

const audioStatus = vi.hoisted(() => ({ value: "idle" }));

vi.mock("../hooks/useAyahAudio", () => ({
  useAyahAudio: () => ({ status: audioStatus.value, play: vi.fn() }),
}));

// The component asks which reciter to build a URL for; the URL is mocked away
// above, so the provider would only be scaffolding.
vi.mock("@/domain/quran", async (importOriginal) => ({
  ...(await importOriginal<QuranModule>()),
  useReciter: () => ({ reciter: { id: "test" }, setReciterId: vi.fn() }),
  getAyahAudioUrl: () => "https://example.test/1.mp3",
}));

const verse: MushafVerse = {
  id: 112001,
  jozz: 30,
  page: 604,
  sura_no: 112,
  sura_name_en: "Al-Ikhlas",
  sura_name_ar: "الإخلاص",
  line_start: 1,
  line_end: 1,
  aya_no: 1,
  // As stored: the ayah, a non-breaking space, and the ayah-number ornament.
  aya_text: "قُلْ هُوَ ٱللَّهُ أَحَدٌ\u00A0\uFC00",
  aya_text_emlaey: "قل هو الله أحد",
};

const question: AudioIdentifyQuizQuestion = {
  id: "q1",
  type: "audio_identify",
  verse,
  verseKey: "112:1",
  testedVerseKey: "112:1",
  audioPrompt: "surah",
  choices: [
    { id: "112", label: "الإخلاص" },
    { id: "113", label: "الفلق" },
  ],
  correctChoiceId: "112",
};

function renderQuestion() {
  render(
    <LocaleProvider>
      <AudioQuestion
        question={question}
        mushafData={[verse]}
        verseInfoRecords={[]}
        answered={false}
        isCorrect={null}
        selectedChoiceId={null}
        streak={0}
        onSubmit={vi.fn()}
        onNext={vi.fn()}
      />
    </LocaleProvider>,
  );
}

describe("AudioQuestion without audio", () => {
  beforeEach(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    window.localStorage.setItem("artqiy.locale", "ar");
    audioStatus.value = "idle";
  });

  it("shows no ayah while the recitation is the cue", () => {
    renderQuestion();
    expect(screen.queryByText(/قُلْ هُوَ/)).not.toBeInTheDocument();
  });

  /*
   * The recitation was this question's only cue, so when it failed there were
   * four options and nothing to go on - no path to a correct answer at all,
   * which INVARIANT 6 forbids.
   */
  it("shows the ayah when the recitation cannot play", () => {
    audioStatus.value = "error";
    renderQuestion();

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/قُلْ هُوَ/)).toBeInTheDocument();
  });

  it("shows the ayah in the Quran face, without the number ornament", () => {
    audioStatus.value = "error";
    renderQuestion();

    const ayah = screen.getByText(/قُلْ هُوَ/);
    expect(ayah).toHaveClass("font-mushaf");
    expect(/[\uFC00-\uFD1D]/.test(ayah.textContent ?? "")).toBe(false);
  });

  it("still offers the options to answer with", () => {
    audioStatus.value = "error";
    renderQuestion();

    expect(screen.getByRole("button", { name: "الإخلاص" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "الفلق" })).toBeEnabled();
  });
});
