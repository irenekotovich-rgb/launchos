// Verifies analytics events fire (requests to PostHog are intercepted and answered locally —
// nothing reaches the real project). Usage: npm run qa:analytics with the app on :3000.
import { chromium } from "playwright";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
// PostHog drops events from HeadlessChrome (built-in bot filter), so present as regular Chrome.
const page = await browser.newPage({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36" });
await page.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => false });
  Object.defineProperty(navigator, "userAgentData", { get: () => undefined }); // its brands say HeadlessChrome
});
const events = [];
const urls = [];
await page.route(/posthog\.com/, async (route) => {
  const req = route.request();
  const isCapture = /\/(e|i\/v0\/e|batch)\/?(\?|$)/.test(new URL(req.url()).pathname + "?");
  if (!isCapture) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  const raw = req.postDataBuffer() ?? Buffer.alloc(0);
  let text = raw.toString("utf8");
  if (text.startsWith("data=")) text = Buffer.from(decodeURIComponent(text.slice(5)), "base64").toString("utf8");
  else {
    try { text = (await import("node:zlib")).gunzipSync(raw).toString("utf8"); } catch { /* not gzip */ }
  }
  if (process.env.DEBUG_QA) console.log(req.url().slice(0, 80), text.slice(0, 120));
  for (const m of text.matchAll(/"event"\s*:\s*"([a-z_]+)"/g)) events.push(m[1]);
  for (const m of text.matchAll(/"\$current_url"\s*:\s*"([^"]+)"/g)) urls.push(m[1]);
  await route.fulfill({ status: 200, body: "{}" });
});
await page.goto(B + "/");
await page.getByRole("link", { name: /Open the demo launch/ }).first().click();
await page.waitForURL(/\/demo/);
await page.locator("#metrics").scrollIntoViewIfNeeded();
await page.waitForTimeout(3500); // posthog batches requests
await page.goto("about:blank"); // flush on unload
await page.waitForTimeout(1000);
console.log("events:", [...new Set(events)].sort().join(", ") || "(none)");
console.log("urls sent:", [...new Set(urls)].join(", ") || "(none)");
await browser.close();
