import { Pin, PinOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

interface MushafFooterPinButtonProps {
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  className?: string;
}

export function MushafFooterPinButton({
  pinned,
  onPinnedChange,
  className,
}: MushafFooterPinButtonProps) {
  const { t } = useTranslation("reader");

  return (
    <button
      type="button"
      className={cn(
        "mushaf-footer-pin min-h-11 min-w-11",
        pinned && "mushaf-footer-pin--active",
        className,
      )}
      onClick={() => onPinnedChange(!pinned)}
      aria-pressed={pinned}
      aria-label={
        pinned ? t("navigation.unpinFooter") : t("navigation.pinFooter")
      }
      title={pinned ? t("navigation.unpin") : t("navigation.pin")}
    >
      {pinned ? (
        <PinOff className="h-3.5 w-3.5" />
      ) : (
        <Pin className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
