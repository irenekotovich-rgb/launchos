import { describe, expect, it } from "vitest";
import { buildPlanDoc } from "./pipeline";
import * as E from "./edit";
import type { LaunchBrief } from "./types";

const NOW = new Date("2026-10-18T09:00:00.000Z");
const LATER = new Date("2026-10-19T09:00:00.000Z");
const brief: LaunchBrief = { productName: "X", what: "w", who: "u", whyNow: "n", targetDate: "2026-12-01T09:00:00.000Z", claims: ["a", "b"] };
const fresh = () => buildPlanDoc(brief, NOW);

describe("edits", () => {
  it("never mutate and always bump updatedAt", () => {
    const doc = fresh();
    const next = E.toggleChecklist(doc, doc.checklist[0].id, LATER);
    expect(doc.checklist[0].done).toBe(false);
    expect(next.checklist[0].done).toBe(true);
    expect(next.meta.updatedAt).toBe(LATER.toISOString());
  });
  it("editing an AI draft turns it manual", () => {
    const doc = fresh();
    doc.analysis.fields.context = { text: "draft", source: "ai-draft", updatedAt: null };
    expect(E.setAnalysisField(doc, "context", "mine", LATER).analysis.fields.context).toMatchObject({ text: "mine", source: "manual" });
  });
  it("lock requires problem, both metric kinds and six signatures", () => {
    let doc = fresh();
    expect(E.lockBlockers(doc)).toHaveLength(4);
    expect(E.lockAlignment(doc, LATER).alignment.lockedAt).toBeNull();
    doc = E.setAlignmentText(doc, "problem", "Approvals live in Slack.", LATER);
    doc = E.upsertMetric(doc, { kind: "success", name: "Adoption", unit: "%", direction: "above", threshold: 15, owner: "PM" }, LATER);
    doc = E.upsertMetric(doc, { kind: "failure", name: "Tickets", unit: "tickets", direction: "above", threshold: 12, owner: "Support" }, LATER);
    for (const team of ["stakeholders", "rnd", "marketing", "sales", "support", "legal"] as const) {
      doc = E.setSignoff(doc, team, { lead: "Lead", status: "signed" }, LATER);
    }
    expect(E.lockBlockers(doc)).toEqual([]);
    const locked = E.lockAlignment(doc, LATER);
    expect(locked.alignment.lockedAt).toBe(LATER.toISOString());
    expect(locked.decisions.map((d) => d.text)).toContain("Alignment locked: problem, success and failure metrics signed off by all six teams.");
    expect(locked.phases.find((p) => p.key === "alignment")?.completedAt).toBe(LATER.toISOString());
  });
  it("signedAt is set on signing and cleared on objection", () => {
    let doc = E.setSignoff(fresh(), "legal", { status: "signed" }, LATER);
    expect(doc.alignment.signoffs.legal.signedAt).toBe(LATER.toISOString());
    doc = E.setSignoff(doc, "legal", { status: "objected", note: "Pricing claim" }, LATER);
    expect(doc.alignment.signoffs.legal).toMatchObject({ signedAt: null, note: "Pricing claim" });
  });
  it("upsert edits in place; remove deletes", () => {
    let doc = E.upsertMetric(fresh(), { id: "m1", kind: "failure", name: "A", unit: "", direction: "above", threshold: 1, owner: "x" }, LATER);
    doc = E.upsertMetric(doc, { id: "m1", kind: "failure", name: "B", unit: "", direction: "above", threshold: 2, owner: "x" }, LATER);
    expect(doc.alignment.metrics).toHaveLength(1);
    expect(doc.alignment.metrics[0].name).toBe("B");
    expect(E.removeMetric(doc, "m1", LATER).alignment.metrics).toHaveLength(0);
  });
  it("closing a phase logs it, noting lateness", () => {
    const doc = fresh();
    const late = new Date(Date.parse(doc.phases[0].eta) + 3_600_000);
    const next = E.completePhase(doc, "analysis", late);
    expect(next.phases[0].completedAt).toBe(late.toISOString());
    expect(next.analysis.completedAt).toBe(late.toISOString());
    expect(next.decisions.at(-1)?.text).toBe("Analysis closed after its ETA.");
    expect(E.completePhase(next, "analysis", late)).toBe(next);
  });
  it("recipients: valid, de-duplicated emails only", () => {
    let doc = E.addRecipient(fresh(), { name: "A", role: "VP", email: "a@example.com", group: "stakeholder" }, LATER);
    doc = E.addRecipient(doc, { name: "A2", role: "VP", email: "A@example.com", group: "stakeholder" }, LATER);
    doc = E.addRecipient(doc, { name: "B", role: "x", email: "not-an-email", group: "team-lead" }, LATER);
    expect(doc.rollout.recipients.map((r) => r.email)).toEqual(["a@example.com"]);
    expect(E.removeRecipient(doc, "a@example.com", LATER).rollout.recipients).toEqual([]);
  });
  it("decisions can be added and edited", () => {
    let doc = E.logDecision(fresh(), "Moved launch a week", LATER);
    const id = doc.decisions.at(-1)!.id;
    doc = E.editDecision(doc, id, "Moved launch a week (legal review)", LATER);
    expect(doc.decisions.at(-1)?.text).toBe("Moved launch a week (legal review)");
  });
});

describe("review PR #8 guards", () => {
  const lockedDoc = () => {
    let doc = E.setAlignmentText(fresh(), "problem", "P", LATER);
    doc = E.upsertMetric(doc, { kind: "success", name: "S", unit: "", direction: "above", threshold: 1, owner: "o" }, LATER);
    doc = E.upsertMetric(doc, { kind: "failure", name: "F", unit: "", direction: "above", threshold: 1, owner: "o" }, LATER);
    for (const t of ["stakeholders", "rnd", "marketing", "sales", "support", "legal"] as const) doc = E.setSignoff(doc, t, { status: "signed" }, LATER);
    return E.lockAlignment(doc, LATER);
  };
  it("locking twice is a no-op", () => {
    const once = lockedDoc();
    expect(E.lockAlignment(once, LATER)).toBe(once);
  });
  it("alignment edits after lock are refused", () => {
    const doc = lockedDoc();
    expect(E.setAlignmentText(doc, "problem", "changed", LATER)).toBe(doc);
    expect(E.upsertMetric(doc, { kind: "failure", name: "X", unit: "", direction: "above", threshold: 2, owner: "o" }, LATER)).toBe(doc);
    expect(E.removeMetric(doc, doc.alignment.metrics[0].id, LATER)).toBe(doc);
    expect(E.setSignoff(doc, "legal", { status: "objected" }, LATER)).toBe(doc);
  });
  it("system decisions can't be edited; PMM edits are marked; empty text refused", () => {
    const doc = fresh(); // d1 is authored by LaunchOS
    expect(E.editDecision(doc, "d1", "changed", LATER)).toBe(doc);
    const mine = E.logDecision(doc, "Mine", LATER);
    const id = mine.decisions.at(-1)!.id;
    expect(E.editDecision(mine, id, "   ", LATER)).toBe(mine);
    expect(E.editDecision(mine, id, "Mine, edited", LATER).decisions.at(-1)).toMatchObject({ text: "Mine, edited", editedAt: LATER.toISOString() });
  });
  it("saving an AI draft unchanged keeps it a draft", () => {
    const doc = fresh();
    doc.analysis.fields.context = { text: "draft", source: "ai-draft", updatedAt: null };
    expect(E.setAnalysisField(doc, "context", "draft", LATER)).toBe(doc);
  });
  it("recipient check reports duplicates and invalid emails; storage is lower-case", () => {
    const doc = E.addRecipient(fresh(), { name: "A", role: "", email: "A@Example.com", group: "stakeholder" }, LATER);
    expect(doc.rollout.recipients[0].email).toBe("a@example.com");
    expect(E.checkRecipient(doc, "a@EXAMPLE.com")).toBe("duplicate");
    expect(E.checkRecipient(doc, "nope")).toBe("invalid-email");
  });
});

describe("drift control", () => {
  const withAssets = () => {
    const doc = fresh();
    doc.assets = [
      { id: "a-faq", type: "faq", title: "FAQ", content: "Q/A", status: "ok", generatedAt: NOW.toISOString(), modelId: "m" },
      { id: "a-blog-post", type: "blog-post", title: "Blog", content: "Text", status: "draft", generatedAt: NOW.toISOString(), modelId: "m" },
    ];
    doc.findings = [{ id: "f", assetId: "a-faq", severity: "high", category: "claim", excerpt: "x", briefReference: "y", suggestion: "z" }];
    return doc;
  };
  const model = { step: "consistency" as const, modelId: "m", ranAt: LATER.toISOString() };

  it("editing the brief flags assets stale, clears findings and logs what changed", () => {
    const next = E.editBrief(withAssets(), { claims: ["a", "b", "c"] }, LATER);
    expect(next.assets.every((a) => a.status === "stale")).toBe(true);
    expect(next.findings).toEqual([]);
    expect(next.decisions.at(-1)?.text).toBe("Brief edited (claims); 2 assets flagged stale.");
  });
  it("an unchanged brief edit is a no-op", () => {
    const doc = withAssets();
    expect(E.editBrief(doc, { claims: ["a", "b"] }, LATER)).toBe(doc);
  });
  it("consistency: high/medium findings drift an asset, low ones don't", () => {
    const next = E.applyConsistency(withAssets(), [
      { id: "1", assetId: "a-faq", severity: "medium", category: "number", excerpt: "", briefReference: "", suggestion: "" },
      { id: "2", assetId: "a-blog-post", severity: "low", category: "tone", excerpt: "", briefReference: "", suggestion: "" },
    ], model, LATER);
    expect(next.assets.map((a) => a.status)).toEqual(["stale", "ok"]);
    expect(next.meta.models.at(-1)?.step).toBe("consistency");
    expect(next.decisions.at(-1)?.text).toMatch(/2 findings, 1 asset drifted/);
  });
  it("regenerating replaces by type and drops that asset's findings", () => {
    const next = E.replaceAsset(withAssets(), { type: "faq", title: "FAQ v2", content: "new", modelId: "m2" }, model, LATER);
    expect(next.assets).toHaveLength(2);
    expect(next.assets[0]).toMatchObject({ title: "FAQ v2", status: "draft", modelId: "m2" });
    expect(next.findings).toEqual([]);
    const added = E.replaceAsset(withAssets(), { type: "linkedin-post", title: "Post", content: "p", modelId: "m" }, model, LATER);
    expect(added.assets).toHaveLength(3);
  });
});

describe("review PR #9: messaging and replace-by-type", async () => {
  const { messagingOrBrief } = await import("./ai-client");
  it("a brief edit marks messaging stale and the brief then wins (avoid list kept)", () => {
    const doc = fresh();
    doc.messaging = { positioning: "p", pillars: ["x"], proofPoints: ["old claim"], avoid: ["SOC 2"] };
    doc.assets = [{ id: "a-faq", type: "faq", title: "FAQ", content: "c", status: "ok", generatedAt: null, modelId: null }];
    expect(messagingOrBrief(doc).proofPoints).toEqual(["old claim"]);
    const edited = E.editBrief(doc, { claims: ["new claim"] }, LATER);
    expect(edited.messaging?.stale).toBe(true);
    expect(messagingOrBrief(edited)).toEqual({ positioning: "w", pillars: [], proofPoints: ["new claim"], avoid: ["SOC 2"] });
  });
  it("replaces an imported asset with a different id by type", () => {
    const doc = fresh();
    doc.assets = [{ id: "imported-7", type: "faq", title: "FAQ", content: "c", status: "stale", generatedAt: null, modelId: null }];
    const next = E.replaceAsset(doc, { type: "faq", title: "FAQ", content: "new", modelId: "m" }, { step: "assets", modelId: "m", ranAt: LATER.toISOString() }, LATER);
    expect(next.assets).toHaveLength(1);
    expect(next.assets[0]).toMatchObject({ id: "imported-7", content: "new" });
  });
});
