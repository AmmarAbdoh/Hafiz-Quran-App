import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = path.resolve(__dirname, "../..");

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

/**
 * The app has a six-step type scale and `text-xs` is not one of its steps.
 * At 12px it is too small generally and particularly in Arabic, which is why
 * `:lang(ar)` lifts interface leading to 1.75 in the first place. `text-label`
 * is the smallest step the scale offers.
 *
 * It had crept back into 16 places across five files, so the rule is enforced
 * rather than remembered.
 */
describe("type scale", () => {
  const files = collectComponentFiles(SOURCE_ROOT);

  it("finds components to check", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("never uses a size outside the scale", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      source.split("\n").forEach((line, index) => {
        if (/\btext-xs\b/.test(line)) {
          offenders.push(
            `${path.relative(SOURCE_ROOT, file)}:${index + 1}: ${line.trim()}`,
          );
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
