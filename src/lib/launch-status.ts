// Pure, derived view of a LaunchDoc: where the project is, when it ends, what may block it.
// No I/O and no clock reads: callers pass `now` so the same doc renders the same everywhere.

import { ROLLOUT_STEPS } from "./types";
import type { LaunchDoc, Metric, Phase, RolloutPercent, RolloutStage, TeamKey, TeamSignoff } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A reading older than this no longer counts as evidence for a gate. */
export const READING_MAX_AGE_MS = 48 * HOUR;
/** A failure metric within this fraction of its threshold raises a warning. */
export const NEAR_THRESHOLD = 0.1;
/** Open checklist items surface as a suggestion once the phase ETA is this close. */
export const CHECKLIST_WARNING_DAYS = 10;

const READING_MAX_AGE_LABEL = `${READING_MAX_AGE_MS / HOUR}h`;
const NEAR_THRESHOLD_LABEL = `${NEAR_THRESHOLD * 100}%`;

export function incrementOf(cumulative: RolloutPercent): number {
  return ROLLOUT_STEPS.find((s) => s.cumulative === cumulative)!.increment;
}

export function signoffList(doc: LaunchDoc): (TeamSignoff & { team: TeamKey })[] {
  return (Object.entries(doc.alignment.signoffs) as [TeamKey, TeamSignoff][]).map(([team, s]) => ({
    team,
    ...s,
  }));
}

// ---------------------------------------------------------------- metrics

export type MetricState = "met" | "not-met" | "breached" | "near" | "ok" | "no-data";

export function metricState(metric: Metric, value: number | undefined): MetricState {
  if (value === undefined) return "no-data";
  const crossed = metric.direction === "above" ? value >= metric.threshold : value <= metric.threshold;
  if (metric.kind === "success") return crossed ? "met" : "not-met";
  if (crossed) return "breached";
  // A zero threshold has no relative margin; never report "near" for it.
  const margin = Math.abs(metric.threshold) * NEAR_THRESHOLD;
  const distance = Math.abs(metric.threshold - value);
  return margin > 0 && distance <= margin ? "near" : "ok";
}

/** Most recent reading by parsed time (string order breaks on mixed precision). */
export function latestReading(stage: RolloutStage, metricId: string) {
  let latest: RolloutStage["readings"][number] | undefined;
  for (const r of stage.readings) {
    if (r.metricId !== metricId) continue;
    if (!latest || Date.parse(r.recordedAt) > Date.parse(latest.recordedAt)) latest = r;
  }
  return latest;
}

// ---------------------------------------------------------------- rollout gate

export interface StageGate {
  /** True when every failure metric has a fresh reading and none is breached. */
  passes: boolean;
  /** The stage was closed with a logged override instead of a passing gate. */
  overridden: boolean;
  /** No failure metrics agreed, so there is nothing to gate on: never a pass. */
  noFailureMetrics: boolean;
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
  const failureMetrics = doc.alignment.metrics.filter((m) => m.kind === "failure");
  const gate: StageGate = {
    passes: true,
    overridden: stage.overrideDecisionId !== null,
    noFailureMetrics: failureMetrics.length === 0,
    breached: [],
    near: [],
    missing: [],
    stale: [],
  };
  for (const metric of failureMetrics) {
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
  gate.passes =
    !gate.noFailureMetrics &&
    gate.breached.length === 0 &&
    gate.missing.length === 0 &&
    gate.stale.length === 0;
  return gate;
}

/** A closed stage is judged as of the moment it closed; open stages as of `now`. */
export function gateMoment(stage: RolloutStage, now: Date): Date {
  return stage.completedAt ? new Date(stage.completedAt) : now;
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
  if (phase.key !== current?.key) return "upcoming";
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

/** How late a phase closed (or, if open, how late it already is). Never negative. */
export function phaseSlipMs(phase: Phase, now: Date): number {
  const end = phase.completedAt ? Date.parse(phase.completedAt) : now.getTime();
  return Math.max(0, end - Date.parse(phase.eta));
}

/**
 * Projected launch day = target date + the larger of
 *  - the slip carried by the most recently closed phase (a late close that the next
 *    phase hasn't absorbed stays visible after it closes), and
 *  - how far the current phase is already past its ETA.
 * Simple enough for a stakeholder to check by hand.
 */
export function projectedEndDate(doc: LaunchDoc, now: Date): Date {
  const target = Date.parse(doc.brief.targetDate);
  const current = currentPhase(doc);
  const closed = doc.phases.filter((p) => p.completedAt);
  const lastClosed = closed.sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!))[0];
  const carried = lastClosed ? phaseSlipMs(lastClosed, now) : 0;
  const open = current ? phaseSlipMs(current, now) : 0;
  return new Date(target + Math.max(carried, open));
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

/**
 * Possible bottlenecks: all "warn" before all "info", otherwise in rule order below.
 * Shown as dismissible suggestions, never as blockers.
 */
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
    const open = signoffList(doc).filter((s) => s.status !== "signed");
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
  if (stage?.status === "halted") {
    out.push({
      id: `stage-halted-${stage.cumulative}`,
      severity: "warn",
      title: `Rollout halted at ${stage.cumulative}%`,
      detail: "Resume the stage or log a decision to roll back.",
      section: "rollout",
    });
  }
  if (doc.alignment.metrics.every((m) => m.kind !== "failure")) {
    out.push({
      id: "no-failure-metrics",
      severity: "warn",
      title: "No failure metrics agreed",
      detail: "Rollout gates need at least one failure metric with a threshold.",
      section: "alignment",
    });
  }
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
        detail: `Within ${NEAR_THRESHOLD_LABEL} of ${m.threshold} ${m.unit} at ${stage.cumulative}%. Owner: ${m.owner}.`,
        section: "metrics",
      });
    }
    if (gate.stale.length || gate.missing.length) {
      out.push({
        id: `readings-stale-${stage.cumulative}`,
        severity: "info",
        title: "Metric readings need an update",
        detail: `${gate.stale.length + gate.missing.length} failure metric(s) have no reading from the last ${READING_MAX_AGE_LABEL}, so the ${stage.cumulative}% gate can't pass.`,
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
    // Open items from any unfinished phase count: phases may overlap.
    const unfinished = new Set(doc.phases.filter((p) => !p.completedAt).map((p) => p.key));
    const open = doc.checklist.filter((c) => unfinished.has(c.phase) && !c.done);
    const daysLeft = (Date.parse(current.eta) - now.getTime()) / DAY;
    if (open.length && daysLeft <= CHECKLIST_WARNING_DAYS) {
      out.push({
        id: `checklist-open-${current.key}`,
        severity: "info",
        title: `${open.length} open checklist item${open.length === 1 ? "" : "s"} before ${current.name} closes`,
        detail: open.map((c) => `${c.label} (${c.owner})`).join("; "),
        section: "plan",
      });
    }
  }

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "warn" ? -1 : 1));
}
