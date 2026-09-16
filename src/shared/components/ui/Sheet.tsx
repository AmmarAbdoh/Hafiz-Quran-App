import * as React from "react";
import type * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogSurface,
  DialogTitle,
} from "@/shared/components/ui/dialog";

/*
 * A sheet is a dialog that arrives from the bottom edge on a phone and is a
 * centred dialog from md up - which is exactly what it always rendered, in a
 * file that restated the portal, the scrim, the close button, the header, the
 * title and the description to say it. All that differs is where the panel
 * sits, so that is all this file contains.
 */
const SHEET_POSITION = [
  "inset-x-0 bottom-0 rounded-t-xl pb-[max(1.5rem,env(safe-area-inset-bottom))]",
  "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
  "md:inset-x-auto md:bottom-auto md:left-[50%] md:top-[50%] md:max-w-lg md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-xl md:pb-6",
  "md:data-[state=closed]:slide-out-to-left-1/2 md:data-[state=closed]:slide-out-to-top-[48%] md:data-[state=open]:slide-in-from-left-1/2 md:data-[state=open]:slide-in-from-top-[48%]",
  "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
].join(" ");

const Sheet = Dialog;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    closeLabel: string;
  }
>((props, ref) => (
  <DialogSurface ref={ref} positionClassName={SHEET_POSITION} {...props} />
));
SheetContent.displayName = "SheetContent";

const SheetHeader = DialogHeader;
const SheetTitle = DialogTitle;
const SheetDescription = DialogDescription;
/** Was written and never exported, so no sheet could have a footer. */
const SheetFooter = DialogFooter;

export {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
};
