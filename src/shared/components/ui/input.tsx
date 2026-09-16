import * as React from "react";
import { cn } from "@/shared/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // text-body, not text-body shrinking at md: - 16px on every width
          // is what keeps iOS Safari from zooming in on focus.
          "flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-body file:border-0 file:bg-transparent file:text-label file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
