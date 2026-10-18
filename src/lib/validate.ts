// Minimal structural guard for LaunchDocs read from storage (and, in M3, imported files).
// Not a full schema: it checks what the UI dereferences, so bad data shows a message instead of crashing.

import { LAUNCH_DOC_SCHEMA_VERSION } from "./types";
import { cleanExpected } from "./money";
import type { Highlight, LaunchDoc } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const TEAMS = ["stakeholders", "rnd", "marketing", "sales", "support", "legal"];
const STAGES = [10, 30, 60, 100];

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
    phases.every((p) => isObj(p) && typeof p.key === "string" && typeof p.eta === "string" && typeof p.start === "string") &&
    rollout.stages.every((s, i) => isObj(s) && s.cumulative === STAGES[i] && typeof s.status === "string" && Array.isArray(s.readings)) &&
    Array.isArray(rollout.recipients) &&
    isObj(alignment) && isObj(alignment.signoffs) && Array.isArray(alignment.metrics) &&
    TEAMS.every((t) => isObj((alignment.signoffs as Record<string, unknown>)[t])) &&
    isObj(analysis) && isObj(analysis.fields) &&
    Array.isArray(v.checklist) && v.checklist.every((c) => isObj(c) && typeof c.id === "string" && typeof c.label === "string") &&
    Array.isArray(v.assets) && v.assets.every((a) => isObj(a) && typeof a.id === "string" && typeof a.type === "string" && typeof a.content === "string") &&
    Array.isArray(v.findings) && v.findings.every((f) => isObj(f) && typeof f.assetId === "string" && typeof f.excerpt === "string") &&
    Array.isArray(v.decisions) && v.decisions.every((d) => isObj(d) && typeof d.id === "string" && typeof d.text === "string" && typeof d.date === "string") &&
    alignment.metrics.every((m) => isObj(m) && typeof m.id === "string" && typeof m.name === "string" && typeof m.threshold === "number")
  );
}

/**
 * Cleans optional, user- or model-authored analysis extras (facts and points) so a malformed file
 * can't crash the room: keeps at most three well-formed facts and string points per area.
 */
export function sanitizeLaunchDoc(doc: LaunchDoc): LaunchDoc {
  const fields = { ...doc.analysis.fields };
  for (const [k, f] of Object.entries(fields) as [keyof typeof fields, (typeof fields)[keyof typeof fields]][]) {
    if (!isObj(f)) continue;
    const highlights = Array.isArray(f.highlights)
      ? f.highlights
          .filter((h): h is NonNullable<typeof h> => isObj(h) && typeof h.value === "string" && typeof h.label === "string")
          .slice(0, 3)
          .map((h) => ({
            value: h.value.slice(0, 40),
            label: h.label.slice(0, 60),
            visual: (h.visual === "meter" || h.visual === "trend" ? h.visual : "stat") as Highlight["visual"],
            ...(typeof h.level === "number" && Number.isFinite(h.level) ? { level: Math.max(0, Math.min(100, h.level)) } : {}),
            ...(h.trend === "up" || h.trend === "down" || h.trend === "flat" ? { trend: h.trend } : {}),
          }))
      : undefined;
    const points = Array.isArray(f.points) ? f.points.filter((p): p is string => typeof p === "string").slice(0, 8) : undefined;
    fields[k] = { ...f, text: typeof f.text === "string" ? f.text : "", highlights, points };
  }
  const expected = cleanExpected(doc.alignment.expected);
  return { ...doc, analysis: { ...doc.analysis, fields }, alignment: { ...doc.alignment, expected } };
}
