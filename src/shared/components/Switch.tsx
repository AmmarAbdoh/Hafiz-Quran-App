import * as React from "react";
import { cn } from "@/shared/lib/utils";

interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

/*
 * A switch: a track, and a thumb sitting at one end of it or the other.
 *
 * It used to render a bordered box styled for children it never had - every
 * caller labels it from outside - so it drew an empty 26x44 rectangle whose
 * only statement of on or off was a tint on its border. Beside a label it
 * read as a broken checkbox rather than a control with a state.
 *
 * The thumb is placed by justify-content rather than by translating it, so it
 * sits at the end of the track in Arabic exactly as it does in English.
 */
const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    { className, pressed, onPressedChange, type = "button", onClick, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      role="switch"
      aria-checked={pressed}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          onPressedChange(!pressed);
        }
      }}
      className={cn(
        // The button is the target and keeps the 44px floor; the track inside
        // is the picture, and is sized for the eye rather than the finger.
        "inline-flex min-h-11 shrink-0 items-center rounded-md px-1",
        "transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-6 w-11 items-center rounded-full p-0.5 transition-colors duration-fast ease-standard",
          pressed ? "justify-end bg-primary" : "justify-start bg-border-strong",
        )}
      >
        <span className="h-5 w-5 rounded-full bg-card shadow-xs" />
      </span>
    </button>
  ),
);
Switch.displayName = "Switch";

export { Switch };
