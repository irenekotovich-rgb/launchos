// runGeneration: brief in → LaunchDoc out. This is the interface the UI depends on.
// M1 builds the plan deterministically and leaves analysis, alignment and assets empty;
// M2 fills the tier rationale, analysis drafts and the six assets with model calls.

import { AUTHOR } from "./author";
import { deriveChecklist, derivePhases, deriveRollout, suggestTier } from "./plan";
import { LAUNCH_DOC_SCHEMA_VERSION } from "./types";
import type { AnalysisField, AnalysisKey, LaunchBrief, LaunchDoc, TeamKey, TeamSignoff } from "./types";

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

export async function runGeneration(brief: LaunchBrief, now: Date = new Date()): Promise<LaunchDoc> {
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
