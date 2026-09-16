import { containsArabicScript } from "@/shared/lib/arabic-normalize";
import { cn } from "@/shared/lib/utils";
import { useQuizFormatters } from "../hooks/useQuizFormatters";

interface QuizAnswerLabelProps {
  label: string;
  /**
   * True when the label is text from the mushaf rather than interface text.
   * A surah name and an ayah are both Arabic; only one of them is scripture,
   * and only one should be set in the Quran face.
   */
  quranScript?: boolean;
  className?: string;
}

/**
 * An answer is a number, an ayah in Arabic, or a surah name in the interface
 * language, so numerals and direction both follow the content.
 */
export function QuizAnswerLabel({
  label,
  quranScript = false,
  className,
}: QuizAnswerLabelProps) {
  const { formatNumber } = useQuizFormatters();
  const isNumeric = /^\d+$/.test(label);
  const arabic = containsArabicScript(label);

  return (
    <bdi
      /* The prompt above these options is already set in the Quran face; an
         answer drawn from the same ayah in the interface font made the two
         halves of one question look like different documents. */
      className={cn(quranScript && arabic && "font-mushaf", className)}
      dir={arabic ? "rtl" : "ltr"}
      lang={arabic ? "ar" : undefined}
    >
      {isNumeric ? formatNumber(Number.parseInt(label, 10)) : label}
    </bdi>
  );
}
