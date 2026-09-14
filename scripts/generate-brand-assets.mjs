// Rasterizes the brand SVG into the PNG sizes that platforms require (iOS
// ignores SVG for apple-touch-icon) and renders the social share card.
// Run with `npm run assets:brand` after changing public/icons/icon.svg.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const ICONS_DIRECTORY = path.resolve("public/icons");
const IMAGES_DIRECTORY = path.resolve("public/images");

// The card is rendered off the same font packages the app loads, so the two
// stay in step without a second copy of the files in the repository.
const resolveFont = createRequire(import.meta.url).resolve;

const PNG_ICONS = [
  { source: "icon.svg", size: 32, output: "favicon-32.png" },
  { source: "icon.svg", size: 180, output: "apple-touch-icon.png" },
  { source: "icon.svg", size: 192, output: "icon-192.png" },
  { source: "icon.svg", size: 512, output: "icon-512.png" },
  { source: "icon-maskable.svg", size: 512, output: "icon-512-maskable.png" },
];

const OG_CARD = { width: 1200, height: 630, output: "og-card.png" };

const browser = await chromium.launch();

async function renderIcons(context) {
  for (const icon of PNG_ICONS) {
    const markup = await readFile(
      path.join(ICONS_DIRECTORY, icon.source),
      "utf8",
    );
    const page = await context.newPage();
    await page.setViewportSize({ width: icon.size, height: icon.size });
    await page.setContent(
      `<!doctype html><html><head><style>
         html,body{margin:0;padding:0;background:transparent}
         svg{display:block;width:${icon.size}px;height:${icon.size}px}
       </style></head><body>${markup}</body></html>`,
      { waitUntil: "load" },
    );
    const output = path.join(ICONS_DIRECTORY, icon.output);
    await page.screenshot({ path: output, omitBackground: true });
    await page.close();
    console.log(`icon  ${icon.output} (${icon.size}px)`);
  }
}

async function renderSocialCard(context) {
  const mark = await readFile(path.join(ICONS_DIRECTORY, "icon.svg"), "utf8");
  const arabicFont = await readFile(
    resolveFont(
      "@fontsource-variable/noto-sans-arabic/files/noto-sans-arabic-arabic-wght-normal.woff2",
    ),
  );
  const latinFont = await readFile(
    resolveFont(
      "@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
    ),
  );

  const page = await context.newPage();
  await page.setViewportSize({ width: OG_CARD.width, height: OG_CARD.height });
  await page.setContent(
    `<!doctype html>
     <html dir="rtl" lang="ar"><head><meta charset="utf-8" /><style>
       :root{color-scheme:dark}
       @font-face{font-family:"Noto Arabic";src:url(data:font/woff2;base64,${arabicFont.toString("base64")}) format("woff2");font-weight:100 900}
       @font-face{font-family:"Inter";src:url(data:font/woff2;base64,${latinFont.toString("base64")}) format("woff2");font-weight:100 900}
       *{margin:0;padding:0;box-sizing:border-box}
       body{
         width:${OG_CARD.width}px;height:${OG_CARD.height}px;
         display:flex;flex-direction:column;align-items:center;justify-content:center;gap:34px;
         background:#0f6b60;color:#fff;
         font-family:"Noto Arabic","Inter",sans-serif;text-align:center;
       }
       .mark{width:128px;height:128px}
       .mark svg{width:100%;height:100%;display:block}
       h1{font-size:104px;font-weight:700;line-height:1.15;letter-spacing:.02em}
       .slogan{font-size:44px;font-weight:600;color:#e8b654}
       p{font-size:31px;font-weight:400;line-height:1.5;color:#cfdedb;max-width:820px}
       .latin{font-family:"Inter",sans-serif;font-size:24px;letter-spacing:.18em;text-transform:uppercase;color:#9fbdb7;font-weight:600}
       .rule{width:200px;height:3px;background:#c49a3c;border-radius:999px}
     </style></head>
     <body>
       <div class="mark">${mark}</div>
       <h1>ارتق</h1>
       <div class="slogan">اقرأ وارتقِ</div>
       <div class="rule"></div>
       <p>رفيقك لقراءة القرآن الكريم ومراجعة الحفظ</p>
       <div class="latin">Artqiy</div>
     </body></html>`,
    { waitUntil: "load" },
  );
  await page.evaluate(() => globalThis.document.fonts.ready);

  const output = path.join(IMAGES_DIRECTORY, OG_CARD.output);
  await page.screenshot({ path: output });
  await page.close();
  console.log(`card  ${OG_CARD.output} (${OG_CARD.width}x${OG_CARD.height})`);
}

const context = await browser.newContext({ deviceScaleFactor: 1 });
await renderIcons(context);
await renderSocialCard(context);
await context.close();
await browser.close();
