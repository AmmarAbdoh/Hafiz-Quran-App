import { expect, test, type Page } from "@playwright/test";

const LOCALE_STORAGE_KEY = "artqiy.locale";

/*
 * The mushaf page is scaled to fit its stage rather than sized from the
 * viewport, so that a page fits the screen and - the part that was most
 * visibly broken - every page renders at the same type size instead of each
 * one being re-fitted by its own measuring pass.
 *
 * These pages are chosen for what they exercise: 3 is a plain 15-line page,
 * 50 and 604 open surahs (604 opens three, and used to be the tallest page in
 * the mushaf by a wide margin), and 400 carries the widest natural line found
 * anywhere in a sample of the corpus.
 */
const PAGES = [3, 50, 400, 604];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    },
    { key: LOCALE_STORAGE_KEY, value: "ar" },
  );
});

async function readMushafPage(page: Page, pageNumber: number) {
  await page.goto(`/quran/page/${pageNumber}`);
  await page.waitForSelector(".mushaf-line__verse", { timeout: 30_000 });
  // The page font is loaded as a FontFace before the glyphs can be measured.
  await page.evaluate(() => document.fonts.ready);

  return page.evaluate(() => {
    const line = document.querySelector(".mushaf-line__verse");
    const stage = document.querySelector(".mushaf-stage");
    const mushafPage = document.querySelector(".mushaf-page");
    if (!line || !stage || !mushafPage) return null;
    return {
      fontSize: Number.parseFloat(getComputedStyle(line).fontSize).toFixed(2),
      pageWidth: mushafPage.getBoundingClientRect().width,
      stageWidth: stage.clientWidth,
      verticalOverflow: stage.scrollHeight - stage.clientHeight,
    };
  });
}

test("every page renders at the same type size", async ({ page }) => {
  const sizes = new Map<number, string>();

  for (const pageNumber of PAGES) {
    const measured = await readMushafPage(page, pageNumber);
    expect(measured, `page ${pageNumber} did not render`).not.toBeNull();
    sizes.set(pageNumber, measured!.fontSize);
    // A page must never be wider than the stage it sits in.
    expect(measured!.pageWidth).toBeLessThanOrEqual(measured!.stageWidth + 1);
  }

  const distinct = new Set(sizes.values());
  expect(
    distinct.size,
    `type size changed between pages: ${[...sizes].map(([p, s]) => `p${p}=${s}px`).join(", ")}`,
  ).toBe(1);
});

test("a plain page fits its stage without scrolling", async ({ page }) => {
  const measured = await readMushafPage(page, 3);
  expect(measured).not.toBeNull();
  expect(measured!.verticalOverflow).toBeLessThanOrEqual(1);
});

test("type size does not change when the bottom bar changes height", async ({
  page,
}) => {
  const before = await readMushafPage(page, 3);
  expect(before).not.toBeNull();

  // Starting a recitation grows the bottom bar. Forcing the height directly
  // covers the same ground without depending on audio actually playing.
  await page.evaluate(() => {
    const chrome = document.querySelector<HTMLElement>(".mushaf-bottom-chrome");
    if (chrome) chrome.style.minHeight = "140px";
  });
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const line = document.querySelector(".mushaf-line__verse");
    return line
      ? Number.parseFloat(getComputedStyle(line).fontSize).toFixed(2)
      : null;
  });

  expect(after).toBe(before!.fontSize);
});
