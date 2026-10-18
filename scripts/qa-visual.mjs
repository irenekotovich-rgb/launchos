// Visual QA: screenshots every route at 390 / 768 / 1440 px into /qa-shots.
// Setup once: npx playwright install chromium
// Usage: npm run qa:visual   (expects the app on BASE_URL, default http://localhost:3000)
//        ROUTES=/,/demo npm run qa:visual
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const WIDTHS = [390, 768, 1440];
const ROUTES = (process.env.ROUTES ?? "/").split(",").map((r) => r.trim()).filter(Boolean);

await mkdir("qa-shots", { recursive: true });
const browser = await chromium.launch();
let failed = false;
try {
  for (const route of ROUTES) {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const name = (route === "/" ? "home" : route.replace(/^\//, "").replaceAll("/", "_")) + `-${width}.png`;
      const response = await page.goto(BASE_URL + route, { waitUntil: "load" });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `qa-shots/${name}`, fullPage: true });
      const status = response?.status() ?? 0;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      if (status >= 400) failed = true;
      console.log(`${name}${status >= 400 ? `  ✗ HTTP ${status}` : ""}${overflow ? "  ⚠ horizontal overflow" : ""}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failed) process.exit(1);
