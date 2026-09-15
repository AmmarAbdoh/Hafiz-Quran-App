import { describe, expect, it } from "vitest";
import { cn } from "./utils";

/**
 * tailwind-merge only recognises the stock Tailwind font-size scale; any
 * other `text-{word}` - including every step of this app's own type scale -
 * falls through to its text-color group instead, so pairing a color with a
 * scale step silently deleted one of them depending on argument order. A
 * plain `<Button size="lg">` rendered with no foreground color because of
 * exactly this, with nothing else in the app's tests able to catch it. This
 * asserts both survive, in both orders, for every scale step and every
 * foreground color role in use.
 */
describe("cn", () => {
  const scaleSteps = [
    "text-display",
    "text-title",
    "text-heading",
    "text-subheading",
    "text-body",
    "text-label",
  ];
  const colorRoles = [
    "text-primary-foreground",
    "text-secondary-foreground",
    "text-muted-foreground",
    "text-accent-foreground",
    "text-destructive-foreground",
    "text-success-foreground",
    "text-card-foreground",
    "text-popover-foreground",
  ];

  it.each(scaleSteps)("keeps a color role alongside %s", (size) => {
    for (const color of colorRoles) {
      expect(cn(color, size)).toBe(`${color} ${size}`);
      expect(cn(size, color)).toBe(`${size} ${color}`);
    }
  });

  it("still resolves a real conflict between two scale steps", () => {
    expect(cn("text-body", "text-label")).toBe("text-label");
  });

  it("still resolves a real conflict between two color roles", () => {
    expect(cn("text-primary-foreground", "text-muted-foreground")).toBe(
      "text-muted-foreground",
    );
  });
});
