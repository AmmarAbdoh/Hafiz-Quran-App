import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/*
 * tailwind-merge only recognises the stock Tailwind scale for each utility.
 * The `text-` prefix is shared between font-size and text-color, and its
 * font-size group only matches literal t-shirt sizes (`sm`, `lg`, ...); any
 * other `text-{word}` - including every step of this app's own type scale
 * (`text-body`, `text-label`, `text-title`, ...) - falls through to the
 * text-color group's catch-all instead. That silently deleted whichever of
 * a color or a size class lost the "conflict": a plain `<Button size="lg">`
 * was rendering with no foreground color at all, because its own `size`
 * classes textually follow its `variant` classes and "later wins". Teaching
 * the merge about these names, rather than fixing every call site, is the
 * only version of the fix that survives the next new component that pairs
 * a text color with a scale step.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["display", "title", "heading", "subheading", "body", "label"],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
