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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        pressed
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card hover:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
Switch.displayName = "Switch";

export { Switch };
