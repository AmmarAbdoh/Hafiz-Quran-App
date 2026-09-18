import { describe, expect, it } from "vitest";
import { isComfortablyVisible, scrollTopForVerse } from "./followScroll";

/** A 800px-tall stage starting at the top of the window. */
const stage = { top: 0, bottom: 800 };

describe("isComfortablyVisible", () => {
  it("counts a verse in the middle of the stage as visible", () => {
    expect(isComfortablyVisible({ top: 300, bottom: 400 }, stage)).toBe(true);
  });

  it("counts a verse below the stage as out of view", () => {
    expect(isComfortablyVisible({ top: 900, bottom: 1000 }, stage)).toBe(false);
  });

  it("counts a verse above the stage as out of view", () => {
    expect(isComfortablyVisible({ top: -200, bottom: -100 }, stage)).toBe(
      false,
    );
  });

  /*
   * The case the old code got wrong in the other direction: a verse clinging
   * to the bottom edge is on screen and still no use to read from, so it
   * counts as out of view and gets scrolled to.
   */
  it("counts a verse clinging to the bottom edge as out of view", () => {
    expect(isComfortablyVisible({ top: 740, bottom: 795 }, stage)).toBe(false);
  });

  it("does not divide by a stage with no height", () => {
    expect(
      isComfortablyVisible({ top: 10, bottom: 20 }, { top: 0, bottom: 0 }),
    ).toBe(true);
  });
});

describe("scrollTopForVerse", () => {
  it("puts the verse in the upper third, not the middle", () => {
    // 500px down the stage, stage scrolled to 1000.
    const next = scrollTopForVerse(
      { top: 500, bottom: 560 },
      stage,
      1000,
      5000,
    );
    // 1000 + 500 - (800 * 0.28) = 1276
    expect(next).toBe(1276);
  });

  it("leaves room below the verse for what comes next", () => {
    const next = scrollTopForVerse(
      { top: 500, bottom: 560 },
      stage,
      1000,
      5000,
    );
    // Where the verse lands relative to the stage top.
    const landsAt = 1000 + 500 - next;
    expect(landsAt).toBeLessThan((stage.bottom - stage.top) / 2);
    expect(landsAt).toBeGreaterThan(0);
  });

  it("never scrolls past the end of the content", () => {
    expect(
      scrollTopForVerse({ top: 700, bottom: 760 }, stage, 4900, 5000),
    ).toBe(5000);
  });

  it("never scrolls above the start", () => {
    expect(scrollTopForVerse({ top: 10, bottom: 70 }, stage, 0, 5000)).toBe(0);
  });

  /*
   * A verse taller than the stage cannot be placed a third of the way down
   * without pushing its own end off the bottom, so it is pinned near the top.
   */
  it("pins a verse taller than the stage near the top", () => {
    const next = scrollTopForVerse(
      { top: 100, bottom: 1400 },
      stage,
      1000,
      5000,
    );
    // 1000 + 100 - (800 * 0.12) = 1004
    expect(next).toBe(1004);
  });
});
