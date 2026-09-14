import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const panelVariants = cva("editorial-panel", {
  variants: {
    variant: {
      default: "",
      flush: "editorial-panel--flush",
      hero: "editorial-panel--hero",
      inset: "editorial-panel--inset",
      raised: "editorial-panel--raised",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type PanelElement = "section" | "article" | "div" | "header";

interface PanelProps
  extends HTMLAttributes<HTMLElement>, VariantProps<typeof panelVariants> {
  as?: PanelElement;
}

export function Panel({
  as: Component = "section",
  className,
  variant,
  ...props
}: PanelProps) {
  return (
    <Component
      className={cn(panelVariants({ variant, className }))}
      {...props}
    />
  );
}
