import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.resolve(__dirname, "../../..");

function collectComponentFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectComponentFiles(entryPath));
    } else if (entry.name.endsWith(".tsx")) {
      files.push(entryPath);
    }
  }
  return files;
}

function findButtonOpeningTags(source: string): string[] {
  return source.match(/<Button\b[^>]*>/gs) ?? [];
}

/**
 * `cn` resolves through tailwind-merge, where the later class in a conflicting
 * group wins. Because `className` is merged after the size variant, a stray
 * `min-h-11` on the element silently defeats `size="lg"`. That downgraded three
 * of the app's most prominent calls to action without any visible error, so the
 * rule is enforced rather than remembered.
 */
describe("Button call sites", () => {
  const files = collectComponentFiles(SOURCE_ROOT);

  it("finds components to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("never set a height that would override the size variant", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const tag of findButtonOpeningTags(source)) {
        if (!/\bmin-h-\d/.test(tag)) continue;
        offenders.push(
          `${path.relative(SOURCE_ROOT, file)}: ${tag.replace(/\s+/g, " ")}`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });

  it("never set min-w on an icon button, which its size already guarantees", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const tag of findButtonOpeningTags(source)) {
        const isIconSize = /size=\{?["']icon["']\}?/.test(tag);
        if (!isIconSize || !/\bmin-w-\d/.test(tag)) continue;
        offenders.push(
          `${path.relative(SOURCE_ROOT, file)}: ${tag.replace(/\s+/g, " ")}`,
        );
      }
    }

    expect(offenders).toEqual([]);
  });
});
