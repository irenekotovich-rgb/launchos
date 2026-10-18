import { describe, expect, it } from "vitest";
import { buildPlanDoc, mergeGenerated, runGeneration } from "./pipeline";
import type { GeneratedContent } from "./ai/generate";
import type { LaunchBrief } from "./types";

const NOW = new Date("2026-10-18T09:00:00.000Z");
const brief: LaunchBrief = {
  productName: "Approval Workflows", what: "w", who: "u", whyNow: "n",
  targetDate: new Date(NOW.getTime() + 60 * 86_400_000).toISOString(), claims: ["one claim"],
};
const content: GeneratedContent = {
  tier: { tier: "T1", rationale: "New persona and pricing change." },
  messaging: { positioning: "p", pillars: ["a", "b", "c"], proofPoints: [], avoid: ["SOC 2 compliant"] },
  analysis: {
    context: { summary: "c", highlights: [{ value: "2,400", label: "workspaces" }], points: ["p"] },
    environment: { summary: "e", highlights: [{ value: "Q1", label: "renewals" }], points: [] },
    competitors: { summary: "", highlights: [], points: [] },
    economics: { summary: "x", highlights: [{ value: "Needs input", label: "payback" }], points: ["Needs your input: model"] },
    capacity: { summary: "y", highlights: [{ value: "5", label: "engineers" }], points: [] },
    audience: { summary: "z", highlights: [{ value: "3+", label: "releases/week" }], points: [] },
  },
  assets: [{ type: "faq", title: "FAQ", content: "Q: A?", modelId: "gemini-3.5-flash" }],
  models: [{ step: "tier", modelId: "gemini-3.5-flash", ranAt: NOW.toISOString(), prompt: "brief-to-tier", promptVersion: 1 }],
  failedAssets: ["blog-post"],
};
const fake = (body: unknown): typeof fetch => (async () => new Response(JSON.stringify(body))) as typeof fetch;

describe("pipeline", () => {
  it("merges AI output and re-derives the plan from the AI tier", () => {
    const base = buildPlanDoc(brief, NOW);
    expect(base.tier.tier).toBe("T3"); // heuristic: one claim
    const doc = mergeGenerated(base, content, NOW);
    expect(doc.tier).toMatchObject({ tier: "T1", rationale: "New persona and pricing change." });
    expect(doc.checklist.length).toBeGreaterThan(base.checklist.length);
    expect(doc.analysis.fields.context).toMatchObject({ text: "c", source: "ai-draft", highlights: [{ value: "2,400", label: "workspaces" }], points: ["p"] });
    expect(doc.analysis.fields.competitors.text).toBe(""); // empty drafts are not written
    expect(doc.assets[0]).toMatchObject({ id: "a-faq", status: "draft", modelId: "gemini-3.5-flash" });
    expect(doc.meta.models[0]).toMatchObject({ prompt: "brief-to-tier", promptVersion: 1 });
    expect(doc.meta.generation?.note).toMatch(/1 of 6 assets generated; 1 failed/);
    expect(doc.messaging?.avoid).toContain("SOC 2 compliant");
  });

  it("keeps the plan and records why when generation is unavailable", async () => {
    const doc = await runGeneration(brief, NOW, fake({ status: "unavailable", message: "busy" }));
    expect(doc.meta.generation).toEqual({ status: "unavailable", note: "busy" });
    expect(doc.phases).toHaveLength(6);
    expect(doc.assets).toEqual([]);
  });

  it("distinguishes an exhausted daily budget", async () => {
    const doc = await runGeneration(brief, NOW, fake({ status: "budget-exhausted", message: "cap" }));
    expect(doc.meta.generation?.status).toBe("budget-exhausted");
  });

  it("survives a network failure", async () => {
    const failing = (async () => { throw new TypeError("offline"); }) as typeof fetch;
    const doc = await runGeneration(brief, NOW, failing);
    expect(doc.meta.generation?.status).toBe("unavailable");
  });

  it("uses the generated result end to end", async () => {
    const doc = await runGeneration(brief, NOW, fake({ status: "ok", content }));
    expect(doc.meta.generation?.status).toBe("live");
  });
});
