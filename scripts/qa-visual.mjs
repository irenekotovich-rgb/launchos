// Visual QA: screenshots every route at 390 / 768 / 1440 px into /qa-shots.
// Usage: npm run qa:visual   (expects the app on BASE_URL, default http://localhost:3000)
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const WIDTHS = [390, 768, 1440];
const ROUTES = (process.env.ROUTES ?? "/").split(",");

await mkdir("qa-shots", { recursive: true });
const browser = await chromium.launch();
for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(BASE_URL + route, { waitUntil: "networkidle" });
    const name = (route === "/" ? "home" : route.replace(/^\//, "").replaceAll("/", "_")) + `-${width}.png`;
    await page.screenshot({ path: `qa-shots/${name}`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    console.log(`${name}${overflow ? "  ⚠ horizontal overflow" : ""}`);
    await page.close();
  }
}
await browser.close();
