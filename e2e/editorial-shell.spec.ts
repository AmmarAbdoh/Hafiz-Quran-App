import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";

const LOCALE_STORAGE_KEY = "artqiy.locale";

function expectedLocale(testInfo: TestInfo): "ar" | "en" {
  return testInfo.project.name === "mobile-arabic" ? "ar" : "en";
}

// Theme and locale are applied after mount, so colour transitions are still
// running on first paint and axe would read blended colours. Waiting for them
// to finish cannot be done reliably, because a transition queued by a class
// change is not observable until the following frame; removing them instead
// snaps every element to its resting colour, which is what the audit is about.
async function settleStyles(page: Page) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      transition: none !important;
      animation: none !important;
    }`,
  });
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)));
      }),
    undefined,
    { timeout: 5000 },
  );
}

async function expectNoAccessibilityViolations(
  page: Page,
  options: { allowInlineMushafTargets?: boolean } = {},
) {
  await settleStyles(page);

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
  // The app warms the Quran dataset in the background so the reader opens
  // instantly. Reporting data saver turns that off, leaving only the requests
  // the shell itself needs, which is what this test is about.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });
  });

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

  const themeTablist = page.getByRole("tablist", {
    name: /Choose appearance|اختيار المظهر/,
  });
  await themeTablist.getByRole("tab", { selected: false }).click();
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
    .getByRole("tab", {
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
    page.locator('.mushaf-word[data-verse-key="1:2"]').first(),
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

  await page.locator(".mushaf-word").first().click();
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
    Object.defineProperty(window, "__artqiyAudioRecords", {
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
    .locator('.mushaf-word[data-location^="1:1:"]')
    .first();
  const secondAyahWord = page
    .locator('.mushaf-word[data-location^="1:2:"]')
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
              __artqiyAudioRecords: Array<{ plays: number }>;
            }
          ).__artqiyAudioRecords.filter(({ plays }) => plays > 0).length,
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
              __artqiyAudioRecords: Array<{
                source: string;
                plays: number;
                pauses: number;
                removed: boolean;
              }>;
            }
          ).__artqiyAudioRecords,
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

/**
 * The point of the goals: a playable session from a cold start in one tap,
 * where the wizard asked for a scope, a set of question types and a session
 * length across three steps first.
 */
test("starts a quiz from a goal in one tap", async ({ page }) => {
  await page.goto("/quiz");
  await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });

  // The button reads "Start"; its accessible name carries the goal, so three
  // cards do not offer three buttons all called the same thing.
  await page
    .getByRole("button", { name: /Review what you read|راجع ما قرأته/i })
    .click();

  // The progress is the header's status line; the heading is the question
  // itself, whichever type the generator picked.
  await expect(
    page.getByText(/Question 1 of|السؤال ١ من/i).first(),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator('section[aria-labelledby="current-quiz-question"] h2'),
  ).toBeVisible();
  // Answerable, whatever type the generator picked: the choice types render
  // pressable options, fill-blank renders a searchable listbox.
  await expect(
    page
      .locator(
        'section[aria-labelledby="current-quiz-question"] button[aria-pressed], section[aria-labelledby="current-quiz-question"] [role="option"]',
      )
      .first(),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

test("completes a quiz and persists its semantic history", async ({ page }) => {
  await page.goto("/quiz");
  await expect(page.locator("h1")).toBeVisible({ timeout: 15_000 });
  await expectNoAccessibilityViolations(page);

  // Setup opens on goals now; the wizard is one of them.
  await page
    .getByRole("button", { name: /Set it up myself|إعداد يدوي/i })
    .click();

  await page
    .getByRole("button", {
      name: /Continue to question types|متابعة إلى أنواع الأسئلة/i,
    })
    .click();

  // Keep only the ayah-number type so the session asks a multiple-choice
  // question rather than the fill-in-the-blank search.
  const questionTypeChoices = page.getByRole("checkbox");
  for (let index = 0; index < (await questionTypeChoices.count()); index += 1) {
    const choice = questionTypeChoices.nth(index);
    if (await choice.isChecked()) await choice.click();
  }
  const ayahNumberChoice = page.locator("#quiz-question-type-ayah_number");
  await ayahNumberChoice.click();
  await expect(ayahNumberChoice).toBeChecked();

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

  // The reviewed ayah must be tinted on a page that mounts already highlighted.
  await page
    .locator('section[aria-labelledby="quiz-review-title"] button')
    .first()
    .click();
  await expect(
    page.locator(".quiz-mushaf-preview .mushaf-ayah-highlight").first(),
  ).toBeVisible({ timeout: 15_000 });

  const storedHistory = await page.evaluate(() =>
    window.localStorage.getItem("quiz-history"),
  );
  expect(storedHistory).toContain('"schemaVersion":3');
  await expectNoAccessibilityViolations(page);
});
