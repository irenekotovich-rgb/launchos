// Records the README GIF: a scripted tour of the demo launch room, then converts it with ffmpeg.
// Requires ffmpeg on PATH (brew install ffmpeg). Usage: npm run build && LAUNCHOS_QA=1 npm start,
// then: node scripts/record-demo-gif.mjs
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "docs/media";
const TMP = "docs/media/.video";
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: TMP, size: { width: 1280, height: 800 } } });
const p = await ctx.newPage();
await p.goto(B + "/");
await p.waitForTimeout(1500);
await p.getByRole("link", { name: /Open the demo launch/ }).first().click();
await p.waitForURL(/\/demo/);
await p.addStyleTag({ content: "html{scroll-behavior:smooth}" });
await p.waitForTimeout(2000);
for (const id of ["analysis", "alignment", "rollout", "metrics", "assets"]) {
  await p.locator(`#${id}`).scrollIntoViewIfNeeded();
  await p.evaluate((sel) => document.querySelector(sel)?.scrollIntoView({ block: "start" }), `#${id}`);
  await p.waitForTimeout(1700);
}
await p.evaluate(() => document.querySelector("#analysis")?.scrollIntoView({ block: "start" }));
await p.waitForTimeout(800);
await p.getByRole("link", { name: /Competitors/ }).first().click();
await p.waitForURL(/analysis\/competitors/);
await p.waitForTimeout(2200);
await ctx.close();
await browser.close();
const webm = readdirSync(TMP).find((f) => f.endsWith(".webm"));
renameSync(`${TMP}/${webm}`, `${TMP}/tour.webm`);
execFileSync("ffmpeg", ["-y", "-i", `${TMP}/tour.webm`, "-vf", "fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle", `${OUT}/demo.gif`], { stdio: ["ignore", "ignore", "inherit"] }); // ffmpeg errors stay visible
console.log("wrote", `${OUT}/demo.gif`);
