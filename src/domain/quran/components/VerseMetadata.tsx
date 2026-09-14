import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useSurahNames } from "../hooks/useSurahNames";
import type { VerseInfoItem, VerseInfoKey } from "../model";

interface VerseMetadataProps {
  items: VerseInfoItem[];
}

export function VerseMetadata({ items }: VerseMetadataProps) {
  const { t, i18n } = useTranslation("reader");
  const { surahName, language: surahLanguage } = useSurahNames();
  const headingId = useId();
  const english = i18n.resolvedLanguage?.startsWith("en") ?? false;
  const numberFormatter = new Intl.NumberFormat(english ? "en-US" : "ar-EG");

  if (items.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg bg-muted p-4">
      <h4 id={headingId} className="mb-3 font-semibold">
        {t("metadata.verseInfo")}
      </h4>
      <table className="w-full text-sm" aria-labelledby={headingId}>
        <tbody>
          {items.map((info) => (
            <tr
              key={info.key}
              className="border-b border-border/50 last:border-0"
            >
              <th scope="row" className="py-2 text-start font-medium">
                {getMetadataLabel(info.key, t)}
              </th>
              <td className="py-2 text-muted-foreground">
                {info.key === "surah" ? (
                  <bdi
                    dir={surahLanguage === "ar" ? "rtl" : "ltr"}
                    lang={surahLanguage}
                  >
                    {surahName(Number(info.value))}
                  </bdi>
                ) : typeof info.value === "number" ? (
                  numberFormatter.format(info.value)
                ) : (
                  info.value
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getMetadataLabel(key: VerseInfoKey, t: TFunction<"reader">): string {
  switch (key) {
    case "surah":
      return t("surah");
    case "ayah":
      return t("ayah");
    case "juz":
      return t("metadata.juz", { number: "" }).trim();
    case "hizb":
      return t("metadata.hizb", { number: "" }).trim();
    case "page":
      return t("page");
  }
}
