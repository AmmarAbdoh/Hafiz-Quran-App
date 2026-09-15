import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    { className, pressed, onPressedChange, type = "button", onClick, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onPressedChange(!pressed);
        }
      }}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-label font-semibold transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        pressed
          ? "border-primary bg-surface-selected text-primary"
          : "border-border bg-card hover:bg-surface-hover",
        className,
      )}
      {...props}
    />
  ),
);
Switch.displayName = "Switch";

export { Switch };
