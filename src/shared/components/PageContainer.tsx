import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

type PageContainerElement = "div" | "section";

interface PageContainerProps extends HTMLAttributes<HTMLElement> {
  as?: PageContainerElement;
}

/**
 * One width for a page's own content, matching the frame the shell already
 * provides (`.editorial-main` in base.css). Routes stopped picking their own
 * max-w-* value - nine different ones across the app - so the column no
 * longer changes width when navigating between them.
 */
export function PageContainer({
  as: Component = "div",
  className,
  ...props
}: PageContainerProps) {
  return (
    <Component
      className={cn("mx-auto w-full max-w-content", className)}
      {...props}
    />
  );
}
