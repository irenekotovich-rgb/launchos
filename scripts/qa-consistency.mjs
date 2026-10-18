// QA for drift control. Generation is answered with a fixed QA fixture (one asset contains
// deliberate drift). The consistency check runs LIVE against the model chain, unless
// QA_STUB_CONSISTENCY=1 (free-tier quotas exhausted) — then a fixed findings fixture is used.
// Usage: [QA_STUB_CONSISTENCY=1] node scripts/qa-consistency.mjs with the app on :3000.
import { chromium } from "playwright";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const now = new Date().toISOString();
const asset = (type, title, content) => ({ type, title, content, modelId: "qa-fixture" });
const content = {
  tier: { tier: "T2", rationale: "QA fixture." },
  messaging: { positioning: "Release approvals with an audit trail, inside the release calendar.", pillars: ["One-click approval", "Audit trail", "Included in Business"], proofPoints: ["Median approval time below 4 hours in beta"], avoid: ["SOC 2 compliant", "any price other than included in Business"] },
  analysis: null,
  assets: [
    asset("release-notes", "Release notes", "New: Approval Workflows. Approve releases in one click; every approval is logged. Included in the Business plan."),
    asset("sales-one-pager", "Sales one-pager", "Approval Workflows makes your release process SOC 2 compliant. Cuts approval time by 70%. Available as a $15/seat add-on."),
  ],
  models: [{ step: "tier", modelId: "qa-fixture", ranAt: now }],
  failedAssets: [],
};
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p.route("**/api/generate", (r) => r.fulfill({ json: { status: "ok", content } }));
if (process.env.QA_STUB_CONSISTENCY) {
  const f = (assetId, severity, category, excerpt, briefReference, suggestion, i) => ({ id: `cf-${i}`, assetId, severity, category, excerpt, briefReference, suggestion });
  await p.route("**/api/consistency", (r) => r.fulfill({ json: { status: "ok", result: {
    findings: [
      f("a-sales-one-pager", "high", "claim", "makes your release process SOC 2 compliant", "Messaging avoid list: SOC 2 compliant", "Every approval is logged with who, when and which checks passed.", 1),
      f("a-sales-one-pager", "high", "number", "Available as a $15/seat add-on.", "Claim: Included in the Business plan at no extra cost", "Included in the Business plan at no extra cost.", 2),
      f("a-sales-one-pager", "medium", "number", "Cuts approval time by 70%.", "Proof point: Median approval time below 4 hours in beta", "Median approval time below 4 hours in beta.", 3),
    ],
    model: { step: "consistency", modelId: "qa-fixture", ranAt: now, prompt: "consistency-rubric", promptVersion: 1 },
  } } }));
}
await p.goto(B + "/new");
await p.fill("#productName", "Approval Workflows");
await p.fill("#what", "Release approvals with named approvers and an audit trail in the release calendar.");
await p.fill("#who", "Release managers at mid-market SaaS companies.");
await p.fill("#whyNow", "Audit season; missing audit trail is a top churn reason.");
await p.fill("#targetDate", "2026-12-15");
await p.fill("#claims", "Approve a release in one click\nEvery approval is logged\nIncluded in the Business plan at no extra cost\nMedian approval time below 4 hours in beta");
await p.click("button[type=submit]");
await p.waitForURL(/launch\//);
await p.addStyleTag({ content: "aside, button[aria-label^='Show']{display:none!important}" });
await p.getByRole("button", { name: /Run consistency check/ }).click();
await p.waitForFunction(() => !document.body.innerText.includes("Checking every asset"), null, { timeout: 150_000 });
await p.locator("#assets").screenshot({ path: "qa-shots/consistency-findings-1440.png" });
console.log("findings text:", (await p.locator("#assets").innerText()).match(/consistency check · \d+ findings?/gi));
// brief edit → stale
await p.getByRole("button", { name: "Edit claims, one per line" }).click();
await p.getByLabel("claims, one per line").fill("Approve a release in one click\nEvery approval is logged\nIncluded in the Business plan at no extra cost");
await p.getByRole("button", { name: "Save" }).click();
await p.locator("#assets").screenshot({ path: "qa-shots/consistency-stale-after-brief-edit-1440.png" });
console.log("stale count:", await p.getByText("Drifted from brief").count());
await p.setViewportSize({ width: 390, height: 900 });
await p.locator("#brief").screenshot({ path: "qa-shots/brief-section-390.png" });
await browser.close();
