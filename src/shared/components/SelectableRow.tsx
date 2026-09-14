import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

/**
 * One control for "an item you tap to choose or navigate to", covering the
 * two shapes that recur across the app: a full-width list row and a bordered
 * grid tile. Selection is a prop rather than left to each caller to invent a
 * background tint for.
 */
const selectableRowVariants = cva(
  "w-full text-start transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        row: "flex min-h-11 items-center gap-3 rounded-md px-3 text-body",
        tile: "min-h-11 rounded-md border border-border px-3 py-2 text-body",
      },
      selected: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "row",
        selected: false,
        class: "hover:bg-surface-hover",
      },
      {
        variant: "row",
        selected: true,
        class: "bg-surface-selected font-medium text-primary",
      },
      {
        variant: "tile",
        selected: false,
        class: "hover:bg-surface-hover",
      },
      {
        variant: "tile",
        selected: true,
        class: "border-primary bg-surface-selected text-primary",
      },
    ],
    defaultVariants: {
      variant: "row",
      selected: false,
    },
  },
);

interface SelectableRowProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof selectableRowVariants> {}

const SelectableRow = React.forwardRef<HTMLButtonElement, SelectableRowProps>(
  ({ className, variant, selected, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(selectableRowVariants({ variant, selected, className }))}
      {...props}
    />
  ),
);
SelectableRow.displayName = "SelectableRow";

export { SelectableRow };
