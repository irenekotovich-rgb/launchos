// Pure, derived view of a LaunchDoc: where the project is, when it ends, what may block it.
// No I/O and no clock reads: callers pass `now` so the same doc renders the same everywhere.

import type { LaunchDoc, Metric, Phase, RolloutStage } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A reading older than this no longer counts as evidence for a gate. */
export const READING_MAX_AGE_MS = 48 * HOUR;
/** A failure metric within this fraction of its threshold raises a warning. */
export const NEAR_THRESHOLD = 0.1;

// ---------------------------------------------------------------- metrics

export type MetricState = "met" | "not-met" | "breached" | "near" | "ok" | "no-data";

export function metricState(metric: Metric, value: number | undefined): MetricState {
  if (value === undefined) return "no-data";
  const crossed = metric.direction === "above" ? value >= metric.threshold : value <= metric.threshold;
  if (metric.kind === "success") return crossed ? "met" : "not-met";
  if (crossed) return "breached";
  const margin = Math.abs(metric.threshold) * NEAR_THRESHOLD;
  const distance = Math.abs(metric.threshold - value);
  return distance <= margin ? "near" : "ok";
}

export function latestReading(stage: RolloutStage, metricId: string) {
  return stage.readings
    .filter((r) => r.metricId === metricId)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
}

// ---------------------------------------------------------------- rollout gate

export interface StageGate {
  /** True when every failure metric has a fresh reading and none is breached. */
  passes: boolean;
  breached: Metric[];
  near: Metric[];
  missing: Metric[];
  stale: Metric[];
}

/**
 * Gate rule (docs/decisions-log.md): a stage may complete when no failure metric is
 * breached and every failure metric has a reading younger than 48h. Success metrics
 * are tracked toward launch day, not used to block a stage.
 */
export function stageGate(doc: LaunchDoc, stage: RolloutStage, now: Date): StageGate {
  const gate: StageGate = { passes: true, breached: [], near: [], missing: [], stale: [] };
  for (const metric of doc.alignment.metrics.filter((m) => m.kind === "failure")) {
    const reading = latestReading(stage, metric.id);
    if (!reading) {
      gate.missing.push(metric);
      continue;
    }
    if (now.getTime() - Date.parse(reading.recordedAt) > READING_MAX_AGE_MS) gate.stale.push(metric);
    const state = metricState(metric, reading.value);
    if (state === "breached") gate.breached.push(metric);
    if (state === "near") gate.near.push(metric);
  }
  gate.passes = gate.breached.length === 0 && gate.missing.length === 0 && gate.stale.length === 0;
  return gate;
}

export function activeStage(doc: LaunchDoc): RolloutStage | undefined {
  return (
    doc.rollout.stages.find((s) => s.status === "live" || s.status === "halted") ??
    doc.rollout.stages.find((s) => s.status === "not-started")
  );
}

export function rolledOutPercent(doc: LaunchDoc): number {
  const live = doc.rollout.stages.filter((s) => s.status !== "not-started");
  return live.length ? Math.max(...live.map((s) => s.cumulative)) : 0;
}

export function isFullyRolledOut(doc: LaunchDoc): boolean {
  return doc.rollout.stages.some((s) => s.cumulative === 100 && s.status === "complete");
}

// ---------------------------------------------------------------- phases & dates

export type PhaseState = "done" | "active" | "upcoming" | "overdue";

export function phaseState(phase: Phase, current: Phase | undefined, now: Date): PhaseState {
  if (phase.completedAt) return "done";
  if (phase !== current) return "upcoming";
  return now.getTime() > Date.parse(phase.eta) ? "overdue" : "active";
}

/** The first phase that isn't complete; undefined once every phase is done. */
export function currentPhase(doc: LaunchDoc): Phase | undefined {
  return doc.phases.find((p) => !p.completedAt);
}

/** Share of phases completed, 0–100. */
export function progressPercent(doc: LaunchDoc): number {
  if (!doc.phases.length) return 0;
  return Math.round((doc.phases.filter((p) => p.completedAt).length / doc.phases.length) * 100);
}

/**
 * Projected launch day: the target date pushed back by however late the current
 * phase already is. Deliberately simple so a stakeholder can check it by hand.
 */
export function projectedEndDate(doc: LaunchDoc, now: Date): Date {
  const target = Date.parse(doc.brief.targetDate);
  const current = currentPhase(doc);
  if (!current) return new Date(target);
  const slip = Math.max(0, now.getTime() - Date.parse(current.eta));
  return new Date(target + slip);
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

export function countdown(target: Date, now: Date): Countdown {
  const diff = target.getTime() - now.getTime();
  let s = Math.max(0, Math.floor(diff / 1000));
  const days = Math.floor(s / 86_400);
  s -= days * 86_400;
  const hours = Math.floor(s / 3_600);
  s -= hours * 3_600;
  const minutes = Math.floor(s / 60);
  return { days, hours, minutes, seconds: s - minutes * 60, past: diff <= 0 };
}

// ---------------------------------------------------------------- bottlenecks

export type SectionId =
  | "overview"
  | "analysis"
  | "alignment"
  | "plan"
  | "rollout"
  | "metrics"
  | "assets"
  | "decisions";

export interface Suggestion {
  id: string;
  severity: "warn" | "info";
  title: string;
  detail: string;
  section: SectionId;
}

/** Possible bottlenecks, most urgent first. Shown as dismissible suggestions, never as blockers. */
export function bottlenecks(doc: LaunchDoc, now: Date): Suggestion[] {
  const out: Suggestion[] = [];
  const current = currentPhase(doc);

  if (current && now.getTime() > Date.parse(current.eta)) {
    const days = Math.ceil((now.getTime() - Date.parse(current.eta)) / DAY);
    out.push({
      id: `phase-overdue-${current.key}`,
      severity: "warn",
      title: `${current.name} is ${days} day${days === 1 ? "" : "s"} past its ETA`,
      detail: `Gate: ${current.gate}. Launch day moves with it unless the phase closes.`,
      section: "plan",
    });
  }

  if (!doc.alignment.lockedAt) {
    const open = doc.alignment.signoffs.filter((s) => s.status !== "signed");
    if (open.length) {
      out.push({
        id: "alignment-open",
        severity: open.some((s) => s.status === "objected") ? "warn" : "info",
        title: `${open.length} team${open.length === 1 ? "" : "s"} haven't signed off`,
        detail: open.map((s) => `${s.lead} (${s.status})`).join(", "),
        section: "alignment",
      });
    }
  }

  const stage = activeStage(doc);
  if (stage && stage.status !== "not-started") {
    const gate = stageGate(doc, stage, now);
    for (const m of gate.breached) {
      out.push({
        id: `metric-breached-${m.id}`,
        severity: "warn",
        title: `${m.name} breached its failure threshold`,
        detail: `Threshold ${m.threshold} ${m.unit}, owner ${m.owner}. Consider halting the ${stage.cumulative}% stage.`,
        section: "metrics",
      });
    }
    for (const m of gate.near) {
      out.push({
        id: `metric-near-${m.id}`,
        severity: "warn",
        title: `${m.name} is close to its failure threshold`,
        detail: `Within 10% of ${m.threshold} ${m.unit} at ${stage.cumulative}%. Owner: ${m.owner}.`,
        section: "metrics",
      });
    }
    if (gate.stale.length || gate.missing.length) {
      out.push({
        id: `readings-stale-${stage.cumulative}`,
        severity: "info",
        title: "Metric readings need an update",
        detail: `${gate.stale.length + gate.missing.length} failure metric(s) have no reading from the last 48h, so the ${stage.cumulative}% gate can't pass.`,
        section: "metrics",
      });
    }
  }

  const next = doc.rollout.stages.find((s) => s.status === "not-started");
  if (next && now.getTime() > Date.parse(next.plannedStart)) {
    out.push({
      id: `stage-late-${next.cumulative}`,
      severity: "warn",
      title: `${next.cumulative}% rollout was planned to start already`,
      detail: "Close the previous stage's gate or log a decision to move the date.",
      section: "rollout",
    });
  }

  const stale = doc.assets.filter((a) => a.status === "stale");
  if (stale.length) {
    out.push({
      id: "assets-stale",
      severity: "warn",
      title: `${stale.length} asset${stale.length === 1 ? " has" : "s have"} drifted from the brief`,
      detail: stale.map((a) => a.title).join(", "),
      section: "assets",
    });
  }

  if (current) {
    const open = doc.checklist.filter((c) => c.phase === current.key && !c.done);
    const daysLeft = (Date.parse(current.eta) - now.getTime()) / DAY;
    if (open.length && daysLeft <= 10) {
      out.push({
        id: `checklist-open-${current.key}`,
        severity: "info",
        title: `${open.length} open checklist item${open.length === 1 ? "" : "s"} in ${current.name}`,
        detail: open.map((c) => `${c.label} (${c.owner})`).join("; "),
        section: "plan",
      });
    }
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warn" ? -1 : 1));
}
