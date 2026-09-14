import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // Journeys that render Mushaf pages and then run a full axe audit do not fit
  // in the 30s default.
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  // Each test boots the whole app and decompresses Quran data, so the default
  // half-the-cores fan-out starves the browsers into spurious timeouts.
  workers: process.env.CI ? undefined : "25%",
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    /*
     * The worker answers Quran data requests from its own context, so once it
     * claims a page those fetches vanish from that page's network and the tests
     * that assert which chunks the reader asks for fail at random. Blocking it
     * keeps every journey measuring the app's own requests.
     */
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "mobile-arabic",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "desktop-english",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
