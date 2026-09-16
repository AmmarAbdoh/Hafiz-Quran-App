import { expect, test } from "@playwright/test";
import path from "node:path";

const LOCALE_STORAGE_KEY = "artqiy.locale";

/*
 * Route-split CSS chunks can, in principle, parse before the app's main
 * stylesheet if their @layer statement is encountered first, which would let
 * Tailwind's own base-layer resets outrank the utilities generated from this
 * app's tokens. That is exactly the failure base.css's unlayered patch
 * (removed - see the design-system history) existed to guard against, so
 * this spec stays as the enforced proof it is not needed: a color role
 * (text-primary-foreground) paired with the app's own text-size scale
 * (text-body / text-label) on a filled, interactive element, checked on a
 * hard-navigated lazy route and under artificial network delay on the main
 * stylesheet - the scenario most likely to reorder which chunk's @layer
 * statement the browser encounters first.
 */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    },
    { key: LOCALE_STORAGE_KEY, value: "en" },
  );
  await page.route(
    "https://verses.quran.foundation/fonts/quran/hafs/**",
    (route) =>
      route.fulfill({
        path: path.resolve("src/assets/fonts/uthmanic_hafs_v20.ttf"),
        contentType: "font/ttf",
        headers: { "Access-Control-Allow-Origin": "*" },
      }),
  );
});

test("a filled button keeps its foreground color on a hard-loaded lazy route", async ({
  page,
}) => {
  await page.goto("/quiz");

  // Scoped to the content landmark: the same "active" nav link exists twice
  // in the DOM (sidebar and mobile bottom dock), and only one is visible at
  // a given viewport, which an unscoped .first() doesn't account for.
  const cta = page
    .locator("#app-content a.bg-primary, #app-content button.bg-primary")
    .first();
  await expect(cta).toBeVisible();
  // --primary-foreground in light mode: white. The bug this guards was the
  // foreground falling back to --foreground (near-black) instead.
  await expect(cta).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("a checked checkbox keeps its foreground color", async ({ page }) => {
  // The checkboxes live in the manual wizard, which setup now offers as one
  // goal among four. The default scope (Al-Fatihah) is enough to reach them;
  // the step nav jumps straight there without filling scope in.
  await page.goto("/quiz");
  await page.getByRole("button", { name: /Set it up myself/i }).click();
  await page.getByRole("button", { name: "Questions" }).first().click();

  const checkbox = page.getByRole("checkbox").first();
  await expect(checkbox).toBeVisible();

  if ((await checkbox.getAttribute("data-state")) !== "checked") {
    await checkbox.click();
  }
  await expect(checkbox).toHaveAttribute("data-state", "checked");
  await expect(checkbox).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("survives the main stylesheet arriving slower than a lazy route's own CSS", async ({
  page,
}) => {
  // Delays every response for the main entry chunk's own CSS specifically,
  // which is the one scenario where a lazy route's stylesheet could
  // plausibly be parsed by the browser first.
  await page.route("**/assets/index-*.css", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });

  await page.goto("/quiz");

  const cta = page
    .locator("#app-content a.bg-primary, #app-content button.bg-primary")
    .first();
  await expect(cta).toBeVisible();
  await expect(cta).toHaveCSS("color", "rgb(255, 255, 255)");
});
