// Viewport-only captures (not full page) so fixed UI such as suggestion popups shows where users see it.
// Usage: ROUTES=/demo node scripts/qa-viewport.mjs
import { chromium } from "playwright";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ROUTES = (process.env.ROUTES ?? "/demo").split(",").map((r) => r.trim()).filter(Boolean);
const browser = await chromium.launch();
try {
  for (const route of ROUTES) {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(BASE_URL + route, { waitUntil: "load" });
      await page.waitForTimeout(800);
      const name = route.replace(/^\//, "").replace(/[/?=&:]/g, "_") || "home";
      await page.screenshot({ path: `qa-shots/${name}-viewport-${w}.png` });
      console.log(`${name}-viewport-${w}.png`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
