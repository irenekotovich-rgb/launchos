// Visual QA of the editing flow on an own launch (generation stubbed — no model calls).
// Usage: node scripts/qa-edit-flow.mjs with the app on :3000.
import { chromium } from "playwright";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
for (const w of [390, 1440]) {
  const p = await browser.newPage({ viewport: { width: w, height: 900 } });
  await p.route("**/api/generate", (r) => r.fulfill({ json: { status: "unavailable", message: "Stubbed for visual QA." } }));
  await p.goto(B + "/new");
  await p.fill("#productName", "Approval Workflows");
  await p.fill("#what", "Release approvals with named approvers and an audit trail.");
  await p.fill("#who", "Release managers at mid-market SaaS companies.");
  await p.fill("#whyNow", "Audit season and churn reasons.");
  await p.fill("#targetDate", "2026-12-15");
  await p.fill("#claims", "Approve in one click\nIncluded in Business");
  await p.click("button[type=submit]");
  await p.waitForURL(/launch\//);
  await p.addStyleTag({ content: "aside, button[aria-label^='Show']{display:none!important}" });
  // alignment: problem
  // keyboard: Escape closes the editor and returns focus to its trigger
  await p.getByRole("button", { name: "Add problem statement" }).click();
  await p.keyboard.press("Escape");
  const focused = await p.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  console.log(w, "focus returned after Escape:", focused === "Add problem statement");
  await p.getByRole("button", { name: "Add problem statement" }).click();
  await p.getByLabel("problem statement").fill("Approvals happen in Slack, so there is no audit trail.");
  await p.getByRole("button", { name: "Save" }).click();
  // metrics
  for (const [kind, name, thr, unit, owner] of [["success", "Workspaces using approvals", "15", "%", "PM"], ["failure", "Approval tickets per 1k workspaces", "12", "tickets", "Support"]]) {
    await p.getByRole("button", { name: `Add ${kind} metric` }).click();
    const form = p.locator("#alignment form");
    await form.getByLabel("Metric name", { exact: true }).fill(name);
    await form.getByLabel("Threshold", { exact: true }).fill(thr);
    await form.getByLabel("Unit", { exact: true }).fill(unit);
    await form.getByLabel("Owner", { exact: true }).fill(owner);
    await form.getByRole("button", { name: "Add metric" }).click();
  }
  await p.locator("#alignment").screenshot({ path: `qa-shots/edit-alignment-${w}.png` });
  // sign-offs
  for (const team of ["Stakeholders", "R&D", "Marketing", "Sales", "Customer Support", "Legal / Compliance"]) {
    await p.getByLabel(`${team} lead`, { exact: true }).fill(`${team.split(" ")[0]} Lead`);
    await p.getByLabel(`${team} lead`, { exact: true }).blur();
    await p.getByLabel(`${team} status`, { exact: true }).selectOption("signed");
  }
  await p.getByRole("button", { name: "Lock alignment" }).click();
  await p.locator("#alignment").screenshot({ path: `qa-shots/edit-alignment-locked-${w}.png` });
  // checklist + close phase
  await p.getByRole("checkbox").first().click();
  await p.getByRole("button", { name: /^Close Analysis/ }).click();
  await p.locator("#plan").screenshot({ path: `qa-shots/edit-checklist-${w}.png` });
  // decisions + recipient
  await p.getByLabel("New decision").fill("Launch moved to Dec 15 for legal review.");
  await p.getByRole("button", { name: "Log", exact: true }).click();
  await p.locator("#decisions").screenshot({ path: `qa-shots/edit-decisions-${w}.png` });
  await p.locator("#rollout").getByLabel("Name", { exact: true }).fill("Elena Varga");
  await p.locator("#rollout").getByLabel("Role", { exact: true }).fill("VP Product");
  await p.locator("#rollout").getByLabel("Email", { exact: true }).fill("elena@example.com");
  await p.locator("#rollout").getByRole("button", { name: "Add" }).click();
  await p.locator("#rollout").screenshot({ path: `qa-shots/edit-recipients-${w}.png` });
  // persistence
  await p.reload();
  const locked = await p.getByText(/Locked .* 6\/6 signed/).count();
  console.log(w, "persisted after reload:", locked > 0);
  await p.close();
}
await browser.close();
