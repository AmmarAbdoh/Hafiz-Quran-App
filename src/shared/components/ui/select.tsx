import * as React from "react";
import { cn } from "@/shared/lib/utils";

/**
 * A native <select> rather than a custom listbox: the browser's own picker
 * already handles touch, keyboard, and screen readers correctly, and the
 * options here are short, static lists that don't need SearchableSelect's
 * filtering.
 */
const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "min-h-12 w-full rounded-md border border-input bg-background px-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
