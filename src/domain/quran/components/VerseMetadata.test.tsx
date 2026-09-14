// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { LocaleProvider, useLocale } from "@/app/i18n";
import { VerseMetadata } from "./VerseMetadata";

function SwitchToEnglish() {
  const { setLocale } = useLocale();
  return (
    <button type="button" onClick={() => setLocale("en")}>
      English
    </button>
  );
}

describe("VerseMetadata", () => {
  it("keeps the Arabic surah name RTL in Arabic", () => {
    window.localStorage.clear();
    render(
      <LocaleProvider>
        <VerseMetadata
          items={[
            { key: "surah", value: "1" },
            { key: "ayah", value: 7 },
          ]}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText("الفاتحة")).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("الفاتحة")).toHaveAttribute("lang", "ar");
  });

  it("localizes semantic labels and transliterates the surah name in English", async () => {
    window.localStorage.clear();
    render(
      <LocaleProvider>
        <SwitchToEnglish />
        <VerseMetadata
          items={[
            { key: "surah", value: "1" },
            { key: "ayah", value: 7 },
          ]}
        />
      </LocaleProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    expect(await screen.findByText("Ayah information")).toBeInTheDocument();
    expect(screen.getByText("Surah")).toBeInTheDocument();
    expect(screen.getByText("Ayah")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("table")).not.toHaveAttribute("dir", "rtl");
    expect(screen.getByText("Al-Fatihah")).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("Al-Fatihah")).toHaveAttribute("lang", "en");
  });
});
