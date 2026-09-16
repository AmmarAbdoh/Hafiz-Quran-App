import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

/*
 * A real height scale. `sm` and `default` used to be the same 44px box
 * differing only in padding, so of five named sizes only three were distinct
 * and there was no compact control for a dense toolbar at all.
 *
 * 44px is still the floor for anything a finger aims at, and it is the floor
 * of `default`, `lg` and `icon`. `sm` is 36px and `compact` 32px: both clear
 * the 24px WCAG 2.2 minimum, and both are for controls that sit inside
 * something already large enough to hit - a row, a bar, a popover - rather
 * than for primary actions. Pick `default` when in doubt.
 *
 * `leading-none` keeps the box predictable in Arabic, where body leading
 * rises to 1.75.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold leading-none transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-surface-hover hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-surface-hover hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success:
          "bg-success text-success-foreground shadow-xs hover:bg-success/90",
      },
      size: {
        /** Dense toolbars and secondary controls inside a larger target. */
        compact: "min-h-8 px-2 text-label font-medium",
        sm: "min-h-9 px-3 text-label font-medium",
        default: "min-h-11 px-4 text-label",
        lg: "min-h-12 px-5 text-body",
        /** Reserved for the single most important action on a screen. */
        xl: "min-h-14 px-7 text-body",
        icon: "min-h-11 min-w-11",
        /** An icon button in a bar, where the bar itself is the large target. */
        "icon-sm": "min-h-9 min-w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
