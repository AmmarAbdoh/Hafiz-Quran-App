import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/*
 * Radix puts `pointer-events: none` on the body while a modal is open and
 * takes it off again on close. Every sheet in the reader is opened from a
 * dropdown menu item, so a menu is closing while a dialog is opening and both
 * are doing that same bookkeeping in the same tick. The style was being left
 * behind: closing the reading preferences left the body at
 * `pointer-events: none`, and nothing on the page could be clicked again for
 * the rest of the visit.
 *
 * This has to sit on the root. The surface below stays mounted whether the
 * dialog is open or shut - only the portal's children come and go - so a
 * cleanup there never runs on close.
 *
 * Once closed, and once Radix has had its own turn, the page gets its clicks
 * back - unless another modal is still up and still wants them gone.
 */
function Dialog({
  open,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  React.useEffect(() => {
    if (open) return;

    const frame = requestAnimationFrame(() => {
      const stillOpen = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"][data-state="open"]',
      );
      if (stillOpen) return;
      if (document.body.style.pointerEvents === "none") {
        document.body.style.removeProperty("pointer-events");
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  return <DialogPrimitive.Root open={open} {...props} />;
}

const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-overlay bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

/**
 * The parts every modal surface shares: the portal, the scrim, the panel and
 * its close button. Only where the panel sits differs - centred for a dialog,
 * against the bottom edge for a sheet - so that is the one thing a caller
 * supplies. Sheet used to restate all of the rest, including a byte-identical
 * close button.
 */
const DialogSurface = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    closeLabel: string;
    positionClassName: string;
  }
>(({ className, children, closeLabel, positionClassName, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-overlay grid w-full gap-4 border bg-background p-6 shadow-lg duration-200 motion-reduce:transition-none motion-reduce:animate-none",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        positionClassName,
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        aria-label={closeLabel}
        className="absolute end-2 top-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md opacity-70 transition-opacity hover:bg-surface-hover hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none data-[state=open]:bg-surface-hover data-[state=open]:text-muted-foreground"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogSurface.displayName = "DialogSurface";

const DIALOG_POSITION =
  "left-[50%] top-[50%] max-w-lg translate-x-[-50%] translate-y-[-50%] data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    closeLabel: string;
  }
>((props, ref) => (
  <DialogSurface ref={ref} positionClassName={DIALOG_POSITION} {...props} />
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-start",
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  // gap, not space-x: a physical-axis margin would sit on the wrong side
  // of each button once the interface direction flips.
  <div
    className={cn(
      "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-subheading font-semibold leading-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-label text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogContent,
  DialogSurface,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
