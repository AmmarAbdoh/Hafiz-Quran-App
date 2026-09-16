// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocaleProvider } from "@/app/i18n";
import { DEMO_AYAH_LABEL } from "@/domain/quran";
import { STORAGE_KEYS } from "@/shared/storage";
import { HomePage } from "./HomePage";

function renderHomePage() {
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <HomePage />
      </LocaleProvider>
    </MemoryRouter>,
  );
}

describe("HomePage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps Quran text Arabic and RTL independently of interface layout", () => {
    renderHomePage();

    const snippet = screen.getByText(DEMO_AYAH_LABEL);
    expect(snippet).toHaveAttribute("lang", "ar");
    expect(snippet).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("link", { name: /ابدأ القراءة/ })).toHaveAttribute(
      "href",
      "/quran/page/1",
    );
  });

  it("offers to resume from a stored reading position", () => {
    storeReadingPosition();

    renderHomePage();

    expect(screen.getByRole("link", { name: /افتح المصحف/ })).toHaveAttribute(
      "href",
      "/quran/surah/2/ayah/25",
    );
  });

  /*
   * The identity used to be swapped out for the resume card, so the moment
   * anyone actually used the app it disappeared for good and the page's h1
   * became "Continue reading".
   */
  it("keeps the app's own heading once there is a position to resume", () => {
    storeReadingPosition();

    renderHomePage();

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("مصحف هادئ للمراجعة المتأنية");
    expect(screen.getByText("متابعة القراءة")).toBeInTheDocument();
  });

  /*
   * There used to be a resume button and a reader-card button side by side,
   * differently labelled, pointing at the identical path.
   */
  it("offers one way into the reader, not two", () => {
    storeReadingPosition();

    renderHomePage();

    const readerLinks = screen
      .getAllByRole("link")
      .filter((link) =>
        link.getAttribute("href")?.startsWith("/quran/surah/2/ayah/25"),
      );
    expect(readerLinks).toHaveLength(1);
  });

  it("reports the streak, accuracy and backlog a quiz leaves behind", () => {
    window.localStorage.setItem(
      "quiz-history",
      JSON.stringify([
        {
          schemaVersion: 3,
          id: "a",
          completedAt: new Date().toISOString(),
          scope: null,
          sessionMode: "fixed",
          questionCount: 10,
          correctCount: 7,
          accuracyByType: {},
          durationMs: 1000,
          answers: [
            {
              questionType: "complete_ayah",
              verseKey: "2:5",
              isCorrect: false,
            },
            {
              questionType: "complete_ayah",
              verseKey: "2:6",
              isCorrect: false,
            },
          ],
        },
      ]),
    );

    renderHomePage();

    expect(screen.getByText("أيام متتالية")).toBeInTheDocument();
    expect(screen.getByText("٧٠٪")).toBeInTheDocument();
    expect(screen.getByText("آية تحتاج مراجعة")).toBeInTheDocument();
    // The quiz action names the backlog rather than offering a blank setup.
    expect(
      screen.getByRole("link", { name: /راجع ما يحتاج تثبيتاً/ }),
    ).toHaveAttribute("href", "/quiz");
  });

  it("says what the review panel is for before any quiz exists", () => {
    renderHomePage();

    expect(
      screen.getByText("أكمل أول اختبار ليظهر تقدمك هنا."),
    ).toBeInTheDocument();
  });
});

function storeReadingPosition() {
  window.localStorage.setItem(
    STORAGE_KEYS.readerPosition,
    JSON.stringify({
      schemaVersion: 1,
      layout: "surah",
      page: 3,
      surah: 2,
      ayah: 25,
      updatedAt: Date.now(),
    }),
  );
}
