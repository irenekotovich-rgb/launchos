// One LIVE end-to-end run (real model calls, counts against the daily budget):
// fill the brief, wait for generation, screenshot the room. Usage: node scripts/qa-live-generate.mjs
import { chromium } from "playwright";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(B + "/new");
await p.fill("#productName", "Shared Dashboards");
await p.fill("#what", "Teams can share live analytics dashboards with read-only links and scheduled email digests.");
await p.fill("#who", "Product managers and team leads at 50–300 person SaaS companies who rebuild the same report every week.");
await p.fill("#whyNow", "Weekly-report rebuilding is the #1 complaint in Q3 NPS verbatims; two competitors launched sharing this quarter.");
await p.fill("#targetDate", "2026-12-10");
await p.fill("#claims", "Share any dashboard with a read-only link in two clicks\nScheduled digests every Monday at 9am\nIncluded in all paid plans");
await p.click("button[type=submit]");
await p.waitForTimeout(800);
await p.screenshot({ path: "qa-shots/new-generating-1440.png" });
await p.waitForURL(/launch\//, { timeout: 180_000 });
await p.waitForTimeout(800);
await p.addStyleTag({ content: "aside, button[aria-label^='Show']{display:none!important}" });
await p.screenshot({ path: "qa-shots/launch-generated-1440.png", fullPage: true });
console.log("done", p.url());
await browser.close();
