import { describe, expect, it } from "vitest";
import { formatAyahCount, getAyahCountLabel } from "@/shared/lib/arabic-count";

describe("getAyahCountLabel", () => {
  it("uses singular for 1 and 11+", () => {
    expect(getAyahCountLabel(1)).toBe("آية");
    expect(getAyahCountLabel(11)).toBe("آية");
    expect(getAyahCountLabel(286)).toBe("آية");
  });

  it("uses dual for 2", () => {
    expect(getAyahCountLabel(2)).toBe("آيتان");
  });

  it("uses plural for 3–10", () => {
    expect(getAyahCountLabel(3)).toBe("آيات");
    expect(getAyahCountLabel(7)).toBe("آيات");
    expect(getAyahCountLabel(10)).toBe("آيات");
  });
});

describe("formatAyahCount", () => {
  it("formats with Arabic numerals by default", () => {
    expect(formatAyahCount(7)).toBe("٧ آيات");
    expect(formatAyahCount(286)).toBe("٢٨٦ آية");
  });
});
