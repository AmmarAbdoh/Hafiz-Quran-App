import { containsArabicScript } from "@/shared/lib/arabic-normalize";
import { useQuizFormatters } from "../hooks/useQuizFormatters";

interface QuizAnswerLabelProps {
  label: string;
  className?: string;
}

/**
 * An answer is a number, an ayah in Arabic, or a surah name in the interface
 * language, so numerals and direction both follow the content.
 */
export function QuizAnswerLabel({ label, className }: QuizAnswerLabelProps) {
  const { formatNumber } = useQuizFormatters();
  const isNumeric = /^\d+$/.test(label);
  const arabic = containsArabicScript(label);

  return (
    <bdi
      className={className}
      dir={arabic ? "rtl" : "ltr"}
      lang={arabic ? "ar" : undefined}
    >
      {isNumeric ? formatNumber(Number.parseInt(label, 10)) : label}
    </bdi>
  );
}
