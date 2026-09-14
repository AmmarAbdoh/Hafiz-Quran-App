import { createContext, useContext, useEffect, useState } from "react";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import {
  LEGACY_STORAGE_KEYS,
  safeStorage,
  STORAGE_KEYS,
} from "@/shared/storage";
import {
  defaultLocale,
  defaultNamespace,
  isLocale,
  resources,
  type Locale,
} from "./resources";

function readInitialLocale(): Locale {
  const storedLocale =
    safeStorage.getItem(STORAGE_KEYS.locale) ??
    safeStorage.getItem(LEGACY_STORAGE_KEYS.locale);
  return isLocale(storedLocale) ? storedLocale : defaultLocale;
}

const i18n = createInstance();
void i18n.init({
  resources,
  lng: readInitialLocale(),
  fallbackLng: defaultLocale,
  defaultNS: defaultNamespace,
  fallbackNS: defaultNamespace,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    safeStorage.setItem(STORAGE_KEYS.locale, locale);
    safeStorage.removeItem(LEGACY_STORAGE_KEYS.locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    void i18n.changeLanguage(locale);

    const translateCommon = i18n.getFixedT(locale, "common");
    document.title = translateCommon("appName");
    // The tagline is a short slogan, so the fuller description is what search
    // results and link previews should show.
    document
      .querySelector<HTMLMetaElement>('meta[name="description"]')
      ?.setAttribute("content", translateCommon("appDescription"));
  }, [locale]);

  return (
    <I18nextProvider i18n={i18n}>
      <LocaleContext.Provider value={{ locale, setLocale }}>
        {children}
      </LocaleContext.Provider>
    </I18nextProvider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return context;
}
