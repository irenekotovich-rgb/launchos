// runGeneration: brief in → LaunchDoc out. This is the interface the UI depends on.
// 1. buildPlanDoc: deterministic plan (tier heuristic, phases, checklist, rollout) — always works.
// 2. POST /api/generate: model-written tier, messaging, analysis drafts and six assets.
// 3. mergeGenerated: the AI tier replaces the heuristic and the plan is re-derived from it.
// If step 2 fails for any reason, the doc keeps the plan and records why (graceful state).

import { AUTHOR } from "./author";
import { deriveChecklist, derivePhases, deriveRollout, suggestTier } from "./plan";
import { LAUNCH_DOC_SCHEMA_VERSION } from "./types";
import type { AnalysisField, AnalysisKey, Asset, LaunchBrief, LaunchDoc, TeamKey, TeamSignoff } from "./types";
import type { GeneratedContent } from "./ai/generate";
import type { GenerateResponse } from "@/app/api/generate/route";

const ANALYSIS_KEYS: AnalysisKey[] = ["context", "environment", "competitors", "economics", "capacity", "audience"];
const TEAMS: TeamKey[] = ["stakeholders", "rnd", "marketing", "sales", "support", "legal"];

/** Works on non-secure origins too (e.g. a self-hosted fork on http://192.168…). */
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" && globalThis.isSecureContext !== false) {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildPlanDoc(brief: LaunchBrief, now: Date = new Date()): LaunchDoc {
  if (!(Date.parse(brief.targetDate) > now.getTime())) throw new RangeError("Launch day must be in the future.");
  const tier = suggestTier(brief, now);
  const phases = derivePhases(tier.tier, brief.targetDate, now);
  const stamp = now.toISOString();
  const emptyField: AnalysisField = { text: "", source: "manual", updatedAt: null };
  const emptySignoff: TeamSignoff = { lead: "", status: "pending", note: "", signedAt: null };

  return {
    schemaVersion: LAUNCH_DOC_SCHEMA_VERSION,
    meta: {
      id: newId(),
      mode: "own",
      createdAt: stamp,
      updatedAt: stamp,
      author: { name: AUTHOR.name, url: AUTHOR.url },
      models: [],
    },
    brief,
    analysis: {
      fields: Object.fromEntries(ANALYSIS_KEYS.map((k) => [k, emptyField])) as Record<AnalysisKey, AnalysisField>,
      completedAt: null,
    },
    alignment: {
      problem: "",
      forWhom: brief.who,
      metrics: [],
      signoffs: Object.fromEntries(TEAMS.map((t) => [t, emptySignoff])) as Record<TeamKey, TeamSignoff>,
      lockedAt: null,
    },
    tier,
    phases,
    checklist: deriveChecklist(tier.tier),
    rollout: deriveRollout(phases),
    assets: [],
    findings: [],
    decisions: [
      {
        id: "d1",
        date: stamp,
        text: `Launch room created; tier ${tier.tier} suggested from the brief.`,
        author: "LaunchOS",
      },
    ],
  };
}

export function mergeGenerated(doc: LaunchDoc, content: GeneratedContent, now: Date = new Date()): LaunchDoc {
  const stamp = now.toISOString();
  const tier = content.tier.tier;
  const phases = derivePhases(tier, doc.brief.targetDate, now);
  const analysisFields = { ...doc.analysis.fields };
  if (content.analysis) {
    for (const k of ANALYSIS_KEYS) {
      const area = content.analysis[k];
      if (!area || (!area.summary.trim() && !area.highlights.length)) continue;
      analysisFields[k] = {
        text: area.summary.trim(),
        highlights: area.highlights.slice(0, 3),
        points: area.points,
        source: "ai-draft",
        updatedAt: stamp,
      };
    }
  }
  const assets: Asset[] = content.assets.map((a) => ({
    id: `a-${a.type}`,
    type: a.type,
    title: a.title,
    status: "draft",
    content: a.content,
    generatedAt: stamp,
    modelId: a.modelId,
  }));
  const missing = content.failedAssets.length;
  return {
    ...doc,
    meta: {
      ...doc.meta,
      updatedAt: stamp,
      models: [...doc.meta.models, ...content.models],
      generation: {
        status: "live",
        note: missing
          ? `${assets.length} of 6 assets generated; ${missing} failed on every model and can be regenerated later.`
          : "Tier, messaging, analysis drafts and six assets generated from the brief.",
      },
    },
    tier: { tier, rationale: content.tier.rationale, overrideDecisionId: null },
    messaging: content.messaging,
    phases,
    checklist: deriveChecklist(tier),
    rollout: deriveRollout(phases),
    analysis: { ...doc.analysis, fields: analysisFields },
    assets,
    decisions: [
      ...doc.decisions,
      { id: `d-${newId().slice(0, 12)}`, date: stamp, text: `AI suggested tier ${tier}; plan re-derived from it.`, author: "LaunchOS" },
    ],
  };
}

export async function runGeneration(
  brief: LaunchBrief,
  now: Date = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<LaunchDoc> {
  const doc = buildPlanDoc(brief, now);
  let res: GenerateResponse;
  try {
    const r = await fetcher("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(brief),
    });
    res = (await r.json()) as GenerateResponse;
  } catch {
    res = { status: "unavailable", message: "Couldn't reach the generator. Your plan was built without AI — try again later." };
  }
  if (res.status === "ok") return mergeGenerated(doc, res.content, now);
  return {
    ...doc,
    meta: {
      ...doc.meta,
      generation: {
        status: res.status === "budget-exhausted" ? "budget-exhausted" : "unavailable",
        note: res.message,
      },
    },
  };
}
