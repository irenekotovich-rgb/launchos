// Captures individual launch-room sections (by id) at 390 and 1440, incl. interactive states.
// Usage: SECTIONS=rollout,metrics node scripts/qa-sections.mjs
import { chromium } from "playwright";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const ROUTE = process.env.ROUTE ?? "/demo";
const SECTIONS = (process.env.SECTIONS ?? "rollout,metrics").split(",");
const browser = await chromium.launch();
try {
  for (const w of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    await page.goto(BASE_URL + ROUTE, { waitUntil: "load" });
    await page.addStyleTag({ content: "aside, button[aria-label^='Show']{display:none!important}" }); // hide fixed popups
    for (const id of SECTIONS) {
      await page.locator(`#${id}`).screenshot({ path: `qa-shots/section-${id}-${w}.png` });
      console.log(`section-${id}-${w}.png`);
    }
    // interactive: open the first stage message, switch metrics to table
    const msg = page.getByRole("button", { name: /View the message|Compose stage message/ }).first();
    if (await msg.count()) { await msg.click(); await page.locator("#rollout").screenshot({ path: `qa-shots/section-rollout-message-${w}.png` }); }
    const table = page.getByRole("button", { name: "Table" });
    if (await table.count()) { await table.click(); await page.locator("#metrics").screenshot({ path: `qa-shots/section-metrics-table-${w}.png` }); }
    await page.close();
  }
} finally {
  await browser.close();
}
