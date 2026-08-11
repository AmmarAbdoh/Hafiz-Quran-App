import { formatDate, formatNumber } from "./format";

describe("locale formatting", () => {
  it("uses the selected locale for numbers", () => {
    expect(formatNumber(1234, "ar")).toBe("١٬٢٣٤");
    expect(formatNumber(1234, "en")).toBe("1,234");
  });

  it("uses the selected locale for dates", () => {
    const date = new Date(Date.UTC(2026, 7, 10));

    expect(formatDate(date, "ar", { year: "numeric" })).toContain("٢٠٢٦");
    expect(formatDate(date, "en", { year: "numeric" })).toContain("2026");
  });
});
