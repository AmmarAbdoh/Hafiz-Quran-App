import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";

type IconButtonProps = React.ComponentProps<typeof Button>;

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "icon", ...props }, ref) => (
    <Button
      ref={ref}
      size={size}
      className={cn("min-h-11 min-w-11", className)}
      {...props}
    />
  ),
);
IconButton.displayName = "IconButton";

export { IconButton };
