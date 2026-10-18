// Minimal structural guard for LaunchDocs read from storage (and, in M3, imported files).
// Not a full schema: it checks what the UI dereferences, so bad data shows a message instead of crashing.

import { LAUNCH_DOC_SCHEMA_VERSION } from "./types";
import type { LaunchDoc } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export function isLaunchDoc(v: unknown): v is LaunchDoc {
  if (!isObj(v) || v.schemaVersion !== LAUNCH_DOC_SCHEMA_VERSION) return false;
  const { meta, brief, tier, phases, rollout, alignment, analysis } = v;
  return (
    isObj(meta) && typeof meta.id === "string" &&
    isObj(brief) && typeof brief.productName === "string" && typeof brief.targetDate === "string" &&
    Array.isArray(brief.claims) &&
    isObj(tier) && typeof tier.tier === "string" &&
    Array.isArray(phases) && phases.length === 6 &&
    isObj(rollout) && Array.isArray(rollout.stages) && rollout.stages.length === 4 &&
    isObj(alignment) && isObj(alignment.signoffs) && Array.isArray(alignment.metrics) &&
    isObj(analysis) && isObj(analysis.fields) &&
    Array.isArray(v.checklist) && Array.isArray(v.assets) && Array.isArray(v.findings) && Array.isArray(v.decisions)
  );
}
