// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/app/i18n";
import type { MushafVerse } from "@/domain/quran";
import { AyahSearchDialog } from "./AyahSearchDialog";

function makeVerse(surah: number, ayah: number, text: string): MushafVerse {
  return {
    id: surah * 1000 + ayah,
    jozz: 1,
    page: 1,
    sura_no: surah,
    sura_name_en: "Test",
    sura_name_ar: "اختبار",
    line_start: 1,
    line_end: 1,
    aya_no: ayah,
    aya_text: text,
    aya_text_emlaey: text,
  };
}

const mushafData = [
  makeVerse(1, 1, "بسم الله الرحمن الرحيم"),
  makeVerse(2, 1, "الم"),
  makeVerse(2, 255, "الله لا اله الا هو الحي القيوم"),
];

function renderDialog(language: "ar" | "en") {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  window.localStorage.setItem("artqiy.locale", language);

  const onAyahSelect = vi.fn();
  render(
    <LocaleProvider>
      <AyahSearchDialog
        open
        onOpenChange={() => {}}
        mushafData={mushafData}
        onAyahSelect={onAyahSelect}
      />
    </LocaleProvider>,
  );
  return { onAyahSelect };
}

describe("AyahSearchDialog", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom has no layout, so it implements no scrolling; the dialog keeps the
    // active result in view as the selection moves.
    Element.prototype.scrollIntoView = vi.fn();
  });

  /*
   * Both languages have always told the reader to search by surah name. The
   * field was dir="rtl" lang="ar", so an English reader was told to type a
   * name into a box that only took Arabic, and no surah name matched anyway.
   */
  it("takes its direction from what is typed, not from one language", () => {
    renderDialog("en");

    const input = screen.getByLabelText(/Search text/i);
    expect(input).toHaveAttribute("dir", "auto");
    expect(input).not.toHaveAttribute("lang");
  });

  it("finds a surah by its transliterated name", () => {
    const { onAyahSelect } = renderDialog("en");

    fireEvent.change(screen.getByLabelText(/Search text/i), {
      target: { value: "Baqarah" },
    });

    const option = screen.getByRole("option");
    expect(option).toHaveTextContent("Surah Al-Baqarah, ayah 1");

    fireEvent.click(option);
    expect(onAyahSelect).toHaveBeenCalledWith(2, 1);
  });

  it("finds a surah by its Arabic name", () => {
    const { onAyahSelect } = renderDialog("ar");

    fireEvent.change(screen.getByLabelText(/عبارة البحث/), {
      target: { value: "البقرة" },
    });

    fireEvent.click(screen.getByRole("option"));
    expect(onAyahSelect).toHaveBeenCalledWith(2, 1);
  });

  it("reads a reference written in Arabic-indic digits", () => {
    const { onAyahSelect } = renderDialog("ar");

    fireEvent.change(screen.getByLabelText(/عبارة البحث/), {
      target: { value: "٢:٢٥٥" },
    });

    fireEvent.click(screen.getByRole("option"));
    expect(onAyahSelect).toHaveBeenCalledWith(2, 255);
  });

  /*
   * The go button's string has always taken a label and nothing passed one,
   * so it read "Go to" and named nothing it would go to.
   */
  it("names the ayah the go button would open", () => {
    renderDialog("en");

    fireEvent.change(screen.getByLabelText(/Search text/i), {
      target: { value: "Baqarah" },
    });

    expect(
      screen.getByRole("button", { name: "Go to Surah Al-Baqarah, ayah 1" }),
    ).toBeInTheDocument();
  });
});
