import { Pin, PinOff } from "lucide-react";
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
  return (
    <button
      type="button"
      className={cn("mushaf-footer-pin", pinned && "mushaf-footer-pin--active", className)}
      onClick={() => onPinnedChange(!pinned)}
      aria-pressed={pinned}
      aria-label={pinned ? "إلغاء تثبيت الشريط السفلي" : "تثبيت الشريط السفلي"}
      title={pinned ? "إلغاء التثبيت" : "تثبيت الشريط السفلي"}
    >
      {pinned ? (
        <PinOff className="h-3.5 w-3.5" />
      ) : (
        <Pin className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
