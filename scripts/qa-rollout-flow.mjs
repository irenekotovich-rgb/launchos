// Visual QA of rollout interactions on an own launch seeded from the demo fixture (rollout reset).
// Usage: node scripts/qa-rollout-flow.mjs with the app on :3000.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const doc = JSON.parse(readFileSync("data/demo-launch.json", "utf8"));
const shift = Date.now() - Date.parse("2026-10-18T09:00:00.000Z");
const move = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(Date.parse(v) + shift).toISOString() : Array.isArray(v) ? v.map(move) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, move(x)])) : v);
const seeded = move(doc);
seeded.meta = { ...seeded.meta, id: "qa-rollout", mode: "own" };
seeded.rollout.stages = seeded.rollout.stages.map((s) => ({ ...s, status: "not-started", startedAt: null, completedAt: null, readings: [], notifiedAt: null, overrideDecisionId: null }));
seeded.phases = seeded.phases.map((p) => (p.key === "rollout" ? { ...p, completedAt: null } : p));

const browser = await chromium.launch();
for (const w of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const p = await ctx.newPage();
  await p.goto(B + "/");
  await p.evaluate((d) => localStorage.setItem("launchos:launch:qa-rollout", JSON.stringify(d)), seeded);
  await p.goto(B + "/launch/qa-rollout");
  await p.addStyleTag({ content: "aside, button[aria-label^='Show']{display:none!important}" });
  await p.getByRole("button", { name: "Start 10% stage" }).click();
  await p.locator("#metrics summary").click();
  const m = p.locator("#metrics");
  await m.getByLabel("Approval support tickets per 1k workspaces (tickets)").fill("6.1");
  await m.getByLabel("Releases rolled back due to approval bugs (%)").fill("0.3");
  await m.getByLabel("p95 release calendar load time (ms)").fill("950");
  await m.getByRole("button", { name: "Save readings" }).click();
  await p.getByRole("button", { name: "Complete 10% stage" }).click();
  await p.getByRole("button", { name: "Compose stage message" }).click();
  await p.getByRole("button", { name: "Copy" }).click();
  await p.locator("#rollout").screenshot({ path: `qa-shots/rollout-flow-${w}.png` });
  await m.getByLabel(/Import CSV/).fill("stage,metric,value\n30,f-tickets,13.5\n30,f-rollbacks,0.4\n30,p95 release calendar load time,1100\n40,f-latency,1");
  await m.getByRole("button", { name: "Import" }).click();
  await m.screenshot({ path: `qa-shots/rollout-readings-${w}.png` });
  const gateFail = await p.getByRole("button", { name: "Close with override…" }).count();
  await p.getByRole("button", { name: "Halt…" }).click();
  await p.getByLabel("Why halt this stage?").fill("Ticket spike over threshold");
  await p.getByRole("button", { name: "Halt stage" }).click();
  await p.locator("#rollout").screenshot({ path: `qa-shots/rollout-halted-${w}.png` });
  const sent = await p.getByText(/Stage message sent/).count();
  console.log(w, { gateFailingOffersOverride: gateFail > 0, messageMarkedSent: sent > 0, halted: (await p.getByText("Halted").count()) > 0 });
  await ctx.close();
}
await browser.close();
