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
