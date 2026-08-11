// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LocaleProvider, useLocale } from "@/app/i18n";
import { MushafFontLoadingState } from "@/domain/quran";
import { SearchableRtlSelect } from "@/shared/components/SearchableRtlSelect";
import { PageControls } from "./PageControls";
import { TajweedLegendDialog } from "./TajweedLegendDialog";

function LanguageSwitch() {
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale("en")}>
      Use English
    </button>
  );
}

function SelectHarness() {
  const [value, setValue] = useState("tabari");
  return (
    <SearchableRtlSelect
      id="tafsir"
      value={value}
      onValueChange={setValue}
      options={[
        { value: "tabari", label: "الطبري" },
        { value: "ibn-kathir", label: "ابن كثير" },
      ]}
    />
  );
}

function LocalizedMushafLoading() {
  const { t } = useTranslation("reader");
  return <MushafFontLoadingState compact message={t("loading")} />;
}

describe("reader interface localization", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
  });

  it("renders Arabic by default and switches labels and numerals to English", async () => {
    render(
      <LocaleProvider>
        <LanguageSwitch />
        <LocalizedMushafLoading />
        <PageControls
          currentPage={7}
          totalPages={604}
          onPageChange={() => {}}
        />
      </LocaleProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "جارٍ تحميل صفحة المصحف",
    );
    expect(
      screen.getByRole("button", { name: "الصفحة السابقة" }),
    ).toBeInTheDocument();
    expect(screen.getByText("٧")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Use English"));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Previous page" }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
  });

  it("supports keyboard selection and announces filtered picker results", async () => {
    render(
      <LocaleProvider>
        <LanguageSwitch />
        <label htmlFor="tafsir">مصدر التفسير</label>
        <SelectHarness />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use English" }));
    const combobox = await screen.findByRole("combobox", {
      name: "مصدر التفسير",
    });

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    expect(combobox).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("2 options available")).toBeInTheDocument();

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "Enter" });

    expect(combobox).toHaveValue("ابن كثير");
    expect(combobox.closest("[dir='rtl']")).toBeInTheDocument();
    expect(combobox).toHaveFocus();
  });

  it("translates the tajweed guide while preserving the Arabic default", async () => {
    render(
      <LocaleProvider>
        <LanguageSwitch />
        <TajweedLegendDialog open onOpenChange={() => {}} />
      </LocaleProvider>,
    );

    expect(screen.getByText("دليل ألوان التجويد")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Use English"));

    expect(
      await screen.findByText("Color-coded tajweed guide"),
    ).toBeInTheDocument();
    expect(screen.getByText("Two-count madd")).toBeInTheDocument();
  });
});
