// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import type { MisreadWord } from "@/features/recitation-practice/contract";
import { PracticeSummary } from "./PracticeSummary";

const MISREAD: MisreadWord[] = [
  {
    location: "2:3:4",
    verseKey: "2:3",
    text: "ٱلْكِتَٰبُ",
    /* What the recogniser heard in its place, as letters. */
    heard: { kind: "other", letters: "لكِتَب" },
  },
  {
    location: "2:5:1",
    verseKey: "2:5",
    text: "أُولَٰئِكَ",
    heard: { kind: "stumble", letters: "أُول" },
  },
];

function renderSummary(
  overrides: Partial<Parameters<typeof PracticeSummary>[0]> = {},
) {
  const onPractiseAgain = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <LocaleProvider>
      <PracticeSummary
        open
        onOpenChange={onOpenChange}
        misreadWords={MISREAD}
        totalWords={15}
        progressIndex={15}
        stoppedShort={false}
        onPractiseAgain={onPractiseAgain}
        {...overrides}
      />
    </LocaleProvider>,
  );
  return { onPractiseAgain, onOpenChange };
}

describe("after a recitation", () => {
  /**
   * The point of keeping every misread word: at the end the reader is told
   * which words to go back to, not just that something went wrong.
   */
  it("names each word that needs work and where it was", () => {
    renderSummary();

    expect(screen.getByText("ٱلْكِتَٰبُ")).toBeInTheDocument();
    expect(screen.getByText("آية ٢:٣")).toBeInTheDocument();
    expect(screen.getByText("أُولَٰئِكَ")).toBeInTheDocument();
    expect(screen.getByText("آية ٢:٥")).toBeInTheDocument();
  });

  /*
   * The word on its own answers "which one" and leaves the question the
   * reciter actually has. This is the recogniser's phonemes written as
   * letters, so it is labelled as heard rather than shown as text to read -
   * see `phonemesAsLetters`.
   */
  it("says what was heard in place of the word", () => {
    renderSummary();

    /* Twice: the stumbled word carries what was heard at it too. */
    expect(screen.getAllByText("سُمِع:")).toHaveLength(2);
    expect(screen.getByText("لكِتَب")).toBeInTheDocument();
  });

  /*
   * A word removed from the audio leaves its frames supporting no sound at
   * all, which is a different thing to say than "something else was heard" -
   * and the one the word on its own leaves entirely unsaid.
   */
  it("says plainly when nothing was heard where a word should have been", () => {
    renderSummary({
      misreadWords: [
        {
          location: "2:3:4",
          verseKey: "2:3",
          text: "ٱلْكِتَٰبُ",
          heard: { kind: "nothing" },
        },
      ],
    });

    expect(screen.getByText("لم نسمع هذه الكلمة")).toBeInTheDocument();
    expect(screen.queryByText("سُمِع:")).not.toBeInTheDocument();
  });

  /* Its own sounds were there and the audio did not support them firmly.
     Repeating the word back as the mistake would say only that the feature
     is broken, so it says what it means instead. */
  it("does not repeat the word back as what was heard", () => {
    renderSummary({
      misreadWords: [
        {
          location: "2:3:4",
          verseKey: "2:3",
          text: "ٱلْكِتَٰبُ",
          heard: { kind: "unclear" },
        },
      ],
    });

    expect(screen.getByText("سمِعناها لكن غير واضحة")).toBeInTheDocument();
    expect(screen.queryByText("سُمِع:")).not.toBeInTheDocument();
  });

  /*
   * "Sometimes it says I got no word wrong, but I did." A word fumbled and
   * then recited correctly scores well - the good attempt is in the audio
   * and the alignment uses it - so it is listed on the cursor's evidence
   * instead, and said to be what it was.
   */
  it("says when a word was got wrong and then got right", () => {
    renderSummary();

    expect(screen.getByText("تعثّرت ثم صحّحت")).toBeInTheDocument();
  });

  /*
   * The surest line in the summary, and the only one the reader reports
   * themselves: everything else here is inferred from the audio.
   */
  it("says when the reciter stopped at a word and moved past it", () => {
    renderSummary({
      misreadWords: [
        {
          location: "2:3:4",
          verseKey: "2:3",
          text: "ٱلْكِتَٰبُ",
          heard: { kind: "gaveUp" },
        },
      ],
    });

    expect(screen.getByText("توقفت عندها وتجاوزتها")).toBeInTheDocument();
  });

  it("counts them against the length of the page", () => {
    renderSummary();

    expect(
      screen.getByText("كلمتان تحتاجان مراجعة من ١٥."),
    ).toBeInTheDocument();
  });

  it("says plainly when nothing was misread", () => {
    renderSummary({ misreadWords: [] });

    expect(screen.getByText("تلاوة سليمة.")).toBeInTheDocument();
    expect(screen.getByText("لم تُخطئ في أي كلمة.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("starts another run without being closed first", () => {
    const { onPractiseAgain } = renderSummary();

    fireEvent.click(screen.getByRole("button", { name: "أعد التسميع" }));

    expect(onPractiseAgain).toHaveBeenCalledOnce();
  });

  it("shows nothing until a run has finished", () => {
    renderSummary({ open: false });

    expect(screen.queryByText("نتيجة التسميع")).not.toBeInTheDocument();
  });

  /**
   * The failure this screen most has to avoid.
   *
   * Reporting the judged stretch as the page's total showed three words of a
   * hundred and twenty as a complete, clean recitation - and measured over
   * 3,595 clips, stopping early is how 501 of 1,698 mistakes present.
   */
  it("does not call an unfinished recitation a clean one", () => {
    renderSummary({
      misreadWords: [],
      totalWords: 120,
      progressIndex: 3,
      stoppedShort: true,
    });

    expect(screen.queryByText("تلاوة سليمة.")).not.toBeInTheDocument();
    expect(screen.getByText("سمّعت ٣ من ١٢٠ كلمة.")).toBeInTheDocument();
  });

  /* An empty list read as a clean page by another route. */
  it("says the words it did hear were right", () => {
    renderSummary({
      misreadWords: [],
      totalWords: 120,
      progressIndex: 3,
      stoppedShort: true,
    });

    expect(
      screen.getByText("ما سمّعته كان سليمًا، لكنك لم تُكمل الصفحة."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  /* Stopping early and misreading are different answers; the words win. */
  it("still names the misread words when the run also stopped early", () => {
    renderSummary({ totalWords: 120, progressIndex: 40, stoppedShort: true });

    expect(
      screen.getByText("كلمتان تحتاجان مراجعة من ١٢٠."),
    ).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });
});
