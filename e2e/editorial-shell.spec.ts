import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";

const LOCALE_STORAGE_KEY = "hafiz-quran.locale";

function expectedLocale(testInfo: TestInfo): "ar" | "en" {
  return testInfo.project.name === "mobile-arabic" ? "ar" : "en";
}

// Theme and locale are applied after mount, so colour transitions are still
// running on first paint. Axe reads blended mid-transition colours, so let the
// animations settle to keep the contrast checks measuring the resting state.
async function waitForSettledStyles(page: Page) {
  // Only transitions are awaited; looping animations such as the loading
  // spinner never finish and do not affect the audited colours.
  await page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter((animation) => animation instanceof CSSTransition)
        .every((animation) => animation.playState !== "running"),
    undefined,
    { timeout: 5000 },
  );
}

async function expectNoAccessibilityViolations(
  page: Page,
  options: { allowInlineMushafTargets?: boolean } = {},
) {
  await waitForSettledStyles(page);

  const audit = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag22aa",
  ]);

  // Quran glyph buttons are inline reading content with fixed manuscript metrics,
  // which is the WCAG 2.5.8 inline-target exception. Standalone controls retain
  // the 44px target rule and are covered by the rest of this suite.
  if (options.allowInlineMushafTargets) {
    audit.disableRules(["target-size"]);
  }

  const report = await audit.analyze();
  expect(report.violations).toEqual([]);
}

test.beforeEach(async ({ page }, testInfo) => {
  const locale = expectedLocale(testInfo);
  await page.addInitScript(
    ({ key, value }) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    },
    { key: LOCALE_STORAGE_KEY, value: locale },
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

test("localizes the adaptive shell without loading Quran data", async ({
  page,
}, testInfo) => {
  const quranRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/data/quran/")) {
      quranRequests.push(request.url());
    }
  });

  await page.goto("/");
  const locale = expectedLocale(testInfo);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.locator("html")).toHaveAttribute(
    "dir",
    locale === "ar" ? "rtl" : "ltr",
  );
  await expect(page.locator("html")).toHaveCSS(
    "direction",
    locale === "ar" ? "rtl" : "ltr",
  );
  await expect(page.locator("body")).toHaveCSS("font-family", /Inter Variable/);
  await expect(page.locator("h1")).toBeVisible();
  expect(quranRequests).toEqual([]);
  await expectNoAccessibilityViolations(page);

  await page.locator('a[href="/settings"]:visible').first().click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator("h1")).toBeVisible();
  expect(quranRequests).toEqual([]);
  await expectNoAccessibilityViolations(page);

  const themeChoices = page.locator(
    'button.min-h-12[aria-pressed="false"]:visible',
  );
  await themeChoices.last().click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  const reciterSelect = page.locator("#reciter-select");
  await reciterSelect.click();
  await reciterSelect.fill("Sudais");
  await page
    .getByRole("option", { name: /Sudais|السديس/i })
    .first()
    .click();

  const tafsirSelect = page.locator("#tafseer-select");
  await tafsirSelect.selectOption({ index: 1 });
  const selectedTafsir = await tafsirSelect.inputValue();

  const nextLocale = locale === "ar" ? "en" : "ar";
  await page
    .getByRole("button", {
      name: locale === "ar" ? "English" : "العربية",
    })
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", nextLocale);

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveAttribute("lang", nextLocale);
  await expect(page.locator("#reciter-select")).toHaveValue(/Sudais|السديس/i);
  await expect(page.locator("#tafseer-select")).toHaveValue(selectedTafsir);
  expect(quranRequests).toEqual([]);
});

test("loads only the requested reader chunks and preserves legacy links", async ({
  page,
}) => {
  const quranRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/data/quran/")) {
      quranRequests.push(request.url());
    }
  });

  await page.goto("/quran/scroll/1");
  await expect(page).toHaveURL(/\/quran\/page\/1$/);
  await expect
    .poll(() => quranRequests.some((url) => url.endsWith("/manifest.json")))
    .toBe(true);
  await expect
    .poll(() => quranRequests.some((url) => url.endsWith("/v1/core.json.gz")))
    .toBe(true);
  await expect
    .poll(() =>
      quranRequests.some((url) => url.endsWith("/v1/layout/pages/001.json.gz")),
    )
    .toBe(true);
  await expect(page.locator('[data-page="1"]')).toBeVisible({
    timeout: 30_000,
  });
  expect(quranRequests.some((url) => url.includes("/tafsir/"))).toBe(false);
  await expectNoAccessibilityViolations(page, {
    allowInlineMushafTargets: true,
  });

  await page.goto("/quran/surah/1/ayah/2");
  await expect(page).toHaveURL(/\/quran\/surah\/1\/ayah\/2$/);
  await expect(
    page.locator('button.mushaf-word[data-verse-key="1:2"]').first(),
  ).toBeVisible({ timeout: 30_000 });
});

test("loads a surah and its selected tafsir on demand", async ({ page }) => {
  const quranRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/data/quran/")) {
      quranRequests.push(request.url());
    }
  });

  await page.goto("/quran/surah/1");
  await expect(page.locator('[data-page="1"]')).toBeVisible({
    timeout: 30_000,
  });
  expect(
    quranRequests.some((url) => url.endsWith("/v1/layout/pages/001.json.gz")),
  ).toBe(true);
  expect(quranRequests.some((url) => url.includes("/tafsir/"))).toBe(false);

  await page.locator("button.mushaf-word").first().click();
  await page.getByRole("button", { name: /Open tafsir|فتح التفسير/i }).click();
  await expect(
    page.getByRole("heading", { name: /Ayah tafsir|تفسير الآية/i }),
  ).toBeVisible();
  await expect
    .poll(() => quranRequests.some((url) => url.includes("/v1/tafsir/")))
    .toBe(true);
  await expect(page.locator("article[lang='ar']")).not.toBeEmpty();
  await expectNoAccessibilityViolations(page, {
    allowInlineMushafTargets: true,
  });
});

test("replaces active reader playback with a newly selected ayah", async ({
  page,
}) => {
  await page.addInitScript(() => {
    interface AudioRecord {
      source: string;
      plays: number;
      pauses: number;
      removed: boolean;
    }

    const records: AudioRecord[] = [];
    Object.defineProperty(window, "__hafizAudioRecords", {
      configurable: true,
      value: records,
    });

    class FakeAudio extends EventTarget {
      currentTime = 0;
      duration = 60;
      ended = false;
      paused = true;
      src: string;
      private readonly record: AudioRecord;

      constructor(source = "") {
        super();
        this.src = source;
        this.record = { source, plays: 0, pauses: 0, removed: false };
        records.push(this.record);
      }

      play(): Promise<void> {
        this.paused = false;
        this.record.plays += 1;
        return Promise.resolve();
      }

      pause(): void {
        this.paused = true;
        this.record.pauses += 1;
        this.dispatchEvent(new Event("pause"));
      }

      removeAttribute(name: string): void {
        if (name !== "src") return;
        this.src = "";
        this.record.removed = true;
      }
    }

    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: FakeAudio,
    });
  });
  await page.route("https://api.quran.com/**", (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );

  await page.goto("/quran/page/1");
  const firstAyahWord = page
    .locator('button.mushaf-word[data-location^="1:1:"]')
    .first();
  const secondAyahWord = page
    .locator('button.mushaf-word[data-location^="1:2:"]')
    .first();
  await expect(firstAyahWord).toBeVisible({ timeout: 30_000 });

  await firstAyahWord.click();
  await page
    .getByRole("button", {
      name: /Listen to this ayah|الاستماع إلى الآية/i,
    })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __hafizAudioRecords: Array<{ plays: number }>;
            }
          ).__hafizAudioRecords.filter(({ plays }) => plays > 0).length,
      ),
    )
    .toBe(1);

  await secondAyahWord.click();
  await page
    .getByRole("button", {
      name: /Listen to this ayah|الاستماع إلى الآية/i,
    })
    .click();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __hafizAudioRecords: Array<{
                source: string;
                plays: number;
                pauses: number;
                removed: boolean;
              }>;
            }
          ).__hafizAudioRecords,
      ),
    )
    .toEqual([
      expect.objectContaining({ plays: 1, pauses: 1, removed: true }),
      expect.objectContaining({ plays: 1, removed: false }),
    ]);
});

test("renders an accessible localized 404", async ({ page }) => {
  await page.goto("/not-a-real-route");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator('a[href="/"]:visible').last()).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("completes a quiz and persists its semantic history", async ({
  page,
}, testInfo) => {
  const locale = expectedLocale(testInfo);

  await page.goto("/quiz");
  await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
  await expectNoAccessibilityViolations(page);

  await page
    .getByRole("button", {
      name: /Continue to question types|متابعة إلى أنواع الأسئلة/i,
    })
    .click();

  const questionTypeChoices = page.getByRole("checkbox");
  for (let index = 0; index < (await questionTypeChoices.count()); index += 1) {
    const choice = questionTypeChoices.nth(index);
    const label = await choice.evaluate(
      (element) => element.closest("label")?.textContent ?? "",
    );
    const ayahNumberLabel = locale === "ar" ? "رقم الآية" : "Ayah number";
    if (!label.includes(ayahNumberLabel) && (await choice.isChecked())) {
      await choice.click();
    }
  }

  await page
    .getByRole("button", {
      name: /Continue to session setup|متابعة إلى إعداد الجلسة/i,
    })
    .click();
  await page.getByLabel(/Number of questions|عدد الأسئلة/i).fill("1");
  await page
    .getByRole("button", { name: /Start session|ابدأ الجلسة/i })
    .click();

  const answerChoices = page.locator(
    'section[aria-labelledby="current-quiz-question"] button[aria-pressed]',
  );
  await expect(answerChoices.first()).toBeVisible({ timeout: 15_000 });
  await answerChoices.first().click();
  await page
    .getByRole("button", { name: /Next question|السؤال التالي/i })
    .click();

  await expect(
    page.getByRole("heading", { name: /Session results|نتيجة الجلسة/i }),
  ).toBeVisible();
  const storedHistory = await page.evaluate(() =>
    window.localStorage.getItem("quiz-history"),
  );
  expect(storedHistory).toContain('"schemaVersion":2');
  await expectNoAccessibilityViolations(page);
});
