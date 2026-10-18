// Deterministic plan derivation: tier → runway → phases with ETAs, checklist and rollout dates.
// The AI pipeline (M2) only replaces the tier suggestion and the assets; the plan math stays here.

import { ROLLOUT_STEPS } from "./types";
import type {
  ChecklistItem,
  LaunchBrief,
  Phase,
  PhaseKey,
  Rollout,
  RolloutStage,
  Tier,
  TierDecision,
} from "./types";

const DAY = 86_400_000;

/** Days from kickoff to launch day per tier. */
export const RUNWAY_DAYS: Record<Tier, number> = { T1: 42, T2: 28, T3: 14 };

/** Share of the runway each phase gets, in order. Rollout always ends on launch day. */
const PHASE_SPLIT: { key: PhaseKey; name: string; share: number; gate: string }[] = [
  { key: "analysis", name: "Analysis", share: 0.12, gate: "Six analysis fields filled and reviewed" },
  { key: "alignment", name: "Problem & metrics alignment", share: 0.16, gate: "All teams signed off on problem and metrics" },
  { key: "brief", name: "Brief & messaging", share: 0.1, gate: "Brief locked, claims approved by Legal" },
  { key: "assets", name: "Asset kit", share: 0.16, gate: "Assets reviewed, no high-severity consistency findings" },
  { key: "readiness", name: "Readiness", share: 0.1, gate: "Readiness checklist complete" },
  { key: "rollout", name: "Staged rollout", share: 0.36, gate: "No failure metric breached at each stage; 100% by launch day" },
];

/** Where each rollout stage starts, as a share of the rollout phase. */
const STAGE_START_SHARE = [0, 0.25, 0.55, 1] as const;

const TIER_RATIONALE: Record<Tier, string> = {
  T1: "Broad impact or a large audience: full asset kit, longest runway, staged rollout with exec sign-off.",
  T2: "Meaningful feature for existing users: full asset kit and staged rollout, no paid campaign.",
  T3: "Small or narrow change: release notes, FAQ and a short rollout.",
};

/**
 * Placeholder heuristic until the AI tier step lands (M2): more claims and more
 * runway signal a bigger launch. Always overridable, and labeled as a suggestion.
 */
export function suggestTier(brief: LaunchBrief, now: Date): TierDecision {
  const daysOut = (Date.parse(brief.targetDate) - now.getTime()) / DAY;
  const tier: Tier = brief.claims.length >= 4 && daysOut >= 35 ? "T1" : brief.claims.length >= 2 ? "T2" : "T3";
  return { tier, rationale: TIER_RATIONALE[tier], overrideDecisionId: null };
}

export function derivePhases(tier: Tier, targetDate: string, now: Date): Phase[] {
  const end = Date.parse(targetDate);
  // Never plan into the past: a short runway compresses phases, it doesn't backdate them.
  const start = Math.max(now.getTime(), end - RUNWAY_DAYS[tier] * DAY);
  const span = end - start;
  let cursor = start;
  return PHASE_SPLIT.map((p, i) => {
    const phaseEnd = i === PHASE_SPLIT.length - 1 ? end : cursor + span * p.share;
    const phase: Phase = {
      key: p.key,
      name: p.name,
      start: new Date(cursor).toISOString(),
      eta: new Date(phaseEnd).toISOString(),
      completedAt: null,
      gate: p.gate,
    };
    cursor = phaseEnd;
    return phase;
  });
}

export function deriveRollout(phases: Phase[]): Rollout {
  const rollout = phases.find((p) => p.key === "rollout")!;
  const start = Date.parse(rollout.start);
  const span = Date.parse(rollout.eta) - start;
  const stages = ROLLOUT_STEPS.map(
    (step, i): RolloutStage => ({
      cumulative: step.cumulative,
      status: "not-started",
      plannedStart: new Date(start + span * STAGE_START_SHARE[i]).toISOString(),
      startedAt: null,
      completedAt: null,
      readings: [],
      notifiedAt: null,
      overrideDecisionId: null,
    }),
  ) as Rollout["stages"];
  return { stages, recipients: [] };
}

const CHECKLIST: Record<Tier, Omit<ChecklistItem, "id" | "done" | "note">[]> = {
  T3: [
    { phase: "alignment", label: "Success and failure metrics have owners and thresholds", owner: "PMM" },
    { phase: "assets", label: "Release notes and FAQ reviewed", owner: "PMM" },
    { phase: "readiness", label: "Support briefed", owner: "Support" },
    { phase: "rollout", label: "Feature flag plan for 10/30/60/100% confirmed", owner: "R&D" },
  ],
  T2: [
    { phase: "analysis", label: "Competitor scan written down", owner: "PMM" },
    { phase: "alignment", label: "Success and failure metrics have owners and thresholds", owner: "PMM" },
    { phase: "brief", label: "Claims approved by Legal", owner: "Legal" },
    { phase: "assets", label: "All six assets reviewed by the PMM", owner: "PMM" },
    { phase: "readiness", label: "Sales and Support trained", owner: "Sales" },
    { phase: "readiness", label: "Dashboards live for every agreed metric", owner: "R&D" },
    { phase: "rollout", label: "Feature flag plan for 10/30/60/100% confirmed", owner: "R&D" },
  ],
  T1: [
    { phase: "analysis", label: "Competitor scan written down", owner: "PMM" },
    { phase: "analysis", label: "Capacity confirmed with R&D, Marketing and Support leads", owner: "PMM" },
    { phase: "alignment", label: "Success and failure metrics have owners and thresholds", owner: "PMM" },
    { phase: "alignment", label: "Exec sponsor signed off", owner: "Stakeholders" },
    { phase: "brief", label: "Claims approved by Legal", owner: "Legal" },
    { phase: "assets", label: "All six assets reviewed by the PMM", owner: "PMM" },
    { phase: "readiness", label: "Sales and Support trained", owner: "Sales" },
    { phase: "readiness", label: "Dashboards live for every agreed metric", owner: "R&D" },
    { phase: "rollout", label: "Feature flag plan for 10/30/60/100% confirmed", owner: "R&D" },
    { phase: "rollout", label: "Launch-day announcement scheduled", owner: "Marketing" },
  ],
};

export function deriveChecklist(tier: Tier): ChecklistItem[] {
  return CHECKLIST[tier].map((item, i) => ({ ...item, id: `c${i + 1}`, done: false, note: "" }));
}
