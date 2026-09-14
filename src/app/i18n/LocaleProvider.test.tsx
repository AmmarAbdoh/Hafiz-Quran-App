// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import {
  LEGACY_STORAGE_KEYS,
  safeStorage,
  STORAGE_KEYS,
} from "@/shared/storage";
import { LocaleProvider, useLocale } from "./LocaleProvider";

function LocaleProbe() {
  const { locale, setLocale } = useLocale();
  const { t } = useTranslation("common");

  return (
    <div>
      <p>{t("appName")}</p>
      <p data-testid="locale">{locale}</p>
      <button type="button" onClick={() => setLocale("en")}>
        English
      </button>
    </div>
  );
}

describe("LocaleProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    const description = document.createElement("meta");
    description.name = "description";
    document.head.append(description);
  });

  afterEach(() => {
    document.querySelector('meta[name="description"]')?.remove();
  });

  it("defaults to Arabic and persists an explicit English choice", async () => {
    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    await waitFor(() => expect(screen.getByText("ارتق")).toBeInTheDocument());
    expect(document.documentElement).toHaveAttribute("lang", "ar");
    expect(document.documentElement).toHaveAttribute("dir", "rtl");
    expect(document.title).not.toBe("");

    fireEvent.click(screen.getByRole("button", { name: "English" }));

    await waitFor(() => expect(screen.getByText("Artqiy")).toBeInTheDocument());
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(safeStorage.getItem(STORAGE_KEYS.locale)).toBe("en");
    expect(document.title).toBe("Artqiy");
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      "Your companion for reading the Quran and reviewing memorization",
    );
  });

  it("adopts a locale stored under the previous app name", async () => {
    window.localStorage.setItem(LEGACY_STORAGE_KEYS.locale, "en");

    render(
      <LocaleProvider>
        <LocaleProbe />
      </LocaleProvider>,
    );

    await waitFor(() => expect(screen.getByText("Artqiy")).toBeInTheDocument());
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
    await waitFor(() =>
      expect(safeStorage.getItem(STORAGE_KEYS.locale)).toBe("en"),
    );
    expect(safeStorage.getItem(LEGACY_STORAGE_KEYS.locale)).toBeNull();
  });
});
