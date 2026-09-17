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
      pageHeight: mushafPage.getBoundingClientRect().height,
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

/*
 * On 21 pages a surah begins on the line straight after the previous one ends,
 * so the Madani grid reserves one slot where the opening needs two - a name
 * band and a bismillah. Those pages rendered a full line taller than the grid
 * they are laid out on, and the name band took its type from the viewport
 * width rather than from the page's own scale, so a short wide window made it
 * taller still. Page 77 is one of them; page 3 has no opening at all.
 */
test("a surah opening squeezed into one line fits like any other page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 480 });

  const opening = await readMushafPage(page, 77);
  const plain = await readMushafPage(page, 3);

  expect(opening).not.toBeNull();
  expect(plain).not.toBeNull();
  expect(opening!.verticalOverflow).toBeLessThanOrEqual(1);
  // Within a few pixels of a page with no opening on it, not a line taller.
  expect(Math.abs(opening!.pageHeight - plain!.pageHeight)).toBeLessThanOrEqual(
    8,
  );
});

/*
 * A wide screen shows a surah rail beside the mushaf. It is out of flow and
 * the layout is padded by its width, because container query units resolve
 * against the content box - so the page is fitted to what is left without
 * knowing the rail is there. Making it a flex sibling instead grew the shell
 * to 6107px and scaled the type to match, which is what this guards.
 */
test("the wide-screen rail does not change the type size", async ({ page }) => {
  await page.setViewportSize({ width: 1279, height: 900 });
  const withoutRail = await readMushafPage(page, 3);
  expect(withoutRail).not.toBeNull();
  expect(await page.locator(".mushaf-reader-rail").isVisible()).toBe(false);

  await page.setViewportSize({ width: 1440, height: 900 });
  const withRail = await readMushafPage(page, 3);
  expect(withRail).not.toBeNull();
  await expect(page.locator(".mushaf-reader-rail")).toBeVisible();

  expect(withRail!.fontSize).toBe(withoutRail!.fontSize);
  expect(withRail!.verticalOverflow).toBeLessThanOrEqual(1);
  // The page never runs under the rail.
  const pageBox = await page.locator(".mushaf-page--full").boundingBox();
  const railBox = await page.locator(".mushaf-reader-rail").boundingBox();
  const overlaps =
    pageBox!.x < railBox!.x + railBox!.width &&
    railBox!.x < pageBox!.x + pageBox!.width;
  expect(overlaps).toBe(false);
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

/*
 * The reader's chrome is centred on the mushaf page, not on the window.
 *
 * Both flanks - the app sidebar and the surah rail - take a slice of the
 * window, and each one is invisible to a different piece of chrome: the
 * header is a sibling of the main that pads itself for the rail, and the dock
 * is fixed to the window and so sees neither. Left to themselves the header
 * sat 160px to the side of the page it names and the bar ran on underneath
 * the sidebar, covering the theme toggle.
 */
test("the header and the bottom bar centre on the page, not the window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await readMushafPage(page, 3)).not.toBeNull();
  await expect(page.locator(".mushaf-reader-rail")).toBeVisible();

  const centres = await page.evaluate(() => {
    const centre = (selector: string) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? box.left + box.width / 2 : null;
    };
    const dock = document.querySelector(".mushaf-bottom-dock");
    const sidebar = document.querySelector(".editorial-sidebar");
    const dockBox = dock?.getBoundingClientRect();
    const sidebarBox = sidebar?.getBoundingClientRect();
    return {
      window: window.innerWidth / 2,
      mushafPage: centre(".mushaf-page"),
      header: centre(".mushaf-reader-header > *"),
      dock: centre(".mushaf-bottom-dock"),
      coversSidebar:
        dockBox && sidebarBox
          ? dockBox.left < sidebarBox.right && sidebarBox.left < dockBox.right
          : null,
    };
  });

  expect(centres.mushafPage).not.toBeNull();
  expect(centres.header).toBeCloseTo(centres.mushafPage!, 0);
  expect(centres.dock).toBeCloseTo(centres.mushafPage!, 0);
  // Guards the measurement itself: if the flanks were equal there would be
  // nothing here to get wrong.
  expect(Math.abs(centres.mushafPage! - centres.window)).toBeGreaterThan(20);
  expect(centres.coversSidebar).toBe(false);
});

/*
 * Surah mode mounts a few pages at a time, so most of a long surah is not in
 * the document yet. A jump asks for a page by number, and a page that is not
 * mounted has no position to scroll to: every such request used to be dropped
 * in silence, which is what "it stops responding" was. Al-Baqarah is the case
 * that matters - 48 pages, of which five are mounted at the start.
 */
test("jumps to a page of a surah that is not mounted yet", async ({ page }) => {
  await page.goto("/quran/surah/2");
  await page.waitForSelector("[data-mushaf-page]", { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);

  const mountedPages = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("[data-mushaf-page]"), (element) =>
        Number(element.getAttribute("data-mushaf-page")),
      ),
    );

  const atStart = await mountedPages();
  expect(atStart.length).toBeGreaterThan(0);
  // The premise: the page we are about to ask for is not in the document.
  expect(atStart).not.toContain(40);

  await page.getByRole("button", { name: "انتقل إلى صفحة" }).click();
  await page.getByRole("textbox", { name: "رقم الصفحة" }).fill("40");
  await page.getByRole("textbox", { name: "رقم الصفحة" }).press("Enter");

  await expect(page.locator('[data-mushaf-page="40"]')).toBeAttached({
    timeout: 10_000,
  });

  // Mounted is not enough - the reader has to actually be taken there.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const target = document.querySelector('[data-mushaf-page="40"]');
          const stage = document.querySelector(".mushaf-stage");
          if (!target || !stage) return null;
          const targetTop = target.getBoundingClientRect().top;
          const stageTop = stage.getBoundingClientRect().top;
          return Math.round(targetTop - stageTop);
        }),
      { timeout: 10_000 },
    )
    .toBeLessThan(200);
});
