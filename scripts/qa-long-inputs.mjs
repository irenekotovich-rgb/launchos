// Visual QA for form states: empty-submit errors, then a 60-char name and 300-char claim
// (CLAUDE.md long-input rule). Usage: npm run qa:long-inputs with the app on :3000.
import { chromium } from "playwright";
const B = "http://localhost:3000";
const name60 = "Approval Workflows for Enterprise Release Calendars, Pro Max"; // 60 chars
const claim300 = "Approve any scheduled release in a single click from the release calendar, the weekly digest email or the mobile app, with every decision recorded in an immutable audit trail that captures who approved, when they approved, which required checks had passed at that moment and which policy version applied.".slice(0, 300);
const browser = await chromium.launch();
for (const w of [390, 768, 1440]) {
  const p = await browser.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(B + "/new"); await p.click("button[type=submit]"); await p.waitForTimeout(200);
  await p.screenshot({ path: `qa-shots/new-errors-${w}.png`, fullPage: true });
  await p.fill("#productName", name60); await p.fill("#what", claim300); await p.fill("#who", "Release managers"); await p.fill("#whyNow", "Audit season");
  await p.fill("#targetDate", "2026-12-15"); await p.fill("#claims", claim300 + "\nIncluded in Business");
  await p.click("button[type=submit]"); await p.waitForURL(/launch\//); await p.waitForTimeout(400);
  await p.screenshot({ path: `qa-shots/launch-own-long-${w}.png`, fullPage: true });
  const o = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  console.log(w, "overflow:", o, p.url().slice(-12));
  await p.close();
}
await browser.close();
