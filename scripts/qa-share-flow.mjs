// QA for export → import and share link create → view → delete (uses the deployment's storage:
// real private Blob when BLOB_READ_WRITE_TOKEN is set, in-memory otherwise).
// Usage: node scripts/qa-share-flow.mjs with the app on :3000.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const doc = JSON.parse(readFileSync("data/demo-launch.json", "utf8"));
doc.meta = { ...doc.meta, id: "qa-share", mode: "own" };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
await p.goto(B + "/");
await p.evaluate((d) => localStorage.setItem("launchos:launch:qa-share", JSON.stringify(d)), doc);
await p.goto(B + "/launch/qa-share");
// export
const [download] = await Promise.all([p.waitForEvent("download"), p.getByRole("button", { name: "Export JSON" }).click()]);
const path = await download.path();
const exported = JSON.parse(readFileSync(path, "utf8"));
console.log("export:", download.suggestedFilename(), "author:", exported.author?.name);
// share
await p.getByRole("button", { name: "Create read-only share link" }).click();
await p.locator('[role="alertdialog"]').screenshot({ path: "qa-shots/share-warning-1440.png" });
await p.getByRole("button", { name: "Create link" }).click();
const url = await p.locator("code").filter({ hasText: "/share/" }).innerText({ timeout: 20_000 });
await p.locator('section[aria-label="Export and share"]').screenshot({ path: "qa-shots/share-created-1440.png" });
const viewer = await browser.newContext({ viewport: { width: 390, height: 900 } });
const v = await viewer.newPage();
const res = await v.goto(url);
const html = await v.content();
console.log("shared page:", res.status(), "has emails:", html.includes("@example.com"), "has lead names:", html.includes("Hannah Brooks"), "noindex:", html.includes("noindex"));
await v.addStyleTag({ content: "aside, button[aria-label^='Show']{display:none!important}" });
await v.screenshot({ path: "qa-shots/share-view-390.png" });
// delete
await p.getByRole("button", { name: "Delete link" }).click();
await p.getByText(/Share link deleted/).waitFor();
const after = await v.goto(url);
console.log("after delete:", after.status());
await v.screenshot({ path: "qa-shots/share-deleted-390.png" });
// import
const imp = await ctx.newPage();
await imp.goto(B + "/new");
await imp.setInputFiles('input[type="file"]', path);
await imp.waitForURL(/launch\//);
await imp.waitForTimeout(500);
await imp.screenshot({ path: "qa-shots/import-result-1440.png" });
console.log("import ok:", (await imp.getByText("Launch imported from a JSON file.").count()) > 0, imp.url());
await browser.close();
