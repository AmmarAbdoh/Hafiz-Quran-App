import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface MushafFooterSurahNavButtonProps {
  direction: "prev" | "next";
  disabled?: boolean;
  surahName?: string;
  title: string;
  onClick: () => void;
}

export function MushafFooterSurahNavButton({
  direction,
  disabled = false,
  surahName,
  title,
  onClick,
}: MushafFooterSurahNavButtonProps) {
  const Icon = direction === "prev" ? ChevronRight : ChevronLeft;
  const ariaLabel = surahName ? `${title}: ${surahName}` : title;

  return (
    <button
      type="button"
      className={cn(
        "mushaf-footer-surah-nav",
        direction === "prev"
          ? "mushaf-footer-surah-nav--prev"
          : "mushaf-footer-surah-nav--next",
        disabled && "mushaf-footer-surah-nav--disabled",
      )}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {direction === "prev" && (
        <Icon className="mushaf-footer-surah-nav__icon" aria-hidden />
      )}
      {surahName ? (
        <span className="mushaf-footer-surah-nav__label font-mushaf">
          {surahName}
        </span>
      ) : null}
      {direction === "next" && (
        <Icon className="mushaf-footer-surah-nav__icon" aria-hidden />
      )}
    </button>
  );
}
