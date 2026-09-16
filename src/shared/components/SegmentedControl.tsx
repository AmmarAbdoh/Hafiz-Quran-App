import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  "aria-label": string;
  className?: string;
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  /*
   * A tablist is a single tab stop: Tab reaches the selected option and the
   * arrows move between them. Without this, the unselected options were
   * unreachable by keyboard entirely - Tab skipped them for their tabIndex of
   * -1 and nothing else moved the roving focus - which on the settings page
   * meant neither language nor theme could be changed without a mouse.
   *
   * It listens on the tabs rather than on the tablist because the tabs are
   * what hold focus; a tablist carrying the handler would have to be focusable
   * itself, which would add a tab stop the pattern does not want.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const current = options.findIndex((option) => option.value === value);
    if (current === -1) return;

    // The arrows follow what the reader sees, so they swap under RTL.
    const rtl =
      getComputedStyle(listRef.current ?? event.currentTarget).direction ===
      "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";

    let next: number;
    if (event.key === forward || event.key === "ArrowDown") {
      next = (current + 1) % options.length;
    } else if (event.key === backward || event.key === "ArrowUp") {
      next = (current - 1 + options.length) % options.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = options.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const option = options[next];
    if (!option) return;

    // Focus before the state change so the ring lands with the selection.
    listRef.current
      ?.querySelectorAll<HTMLButtonElement>("[role='tab']")
      [next]?.focus();
    onValueChange(option.value);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "grid gap-2 rounded-md bg-surface-sunken p-1.5",
        options.length === 2 && "grid-cols-2",
        options.length === 3 && "grid-cols-3",
        options.length > 3 && "grid-flow-col auto-cols-fr",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-3 text-label font-semibold transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
