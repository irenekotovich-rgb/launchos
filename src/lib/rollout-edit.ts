// Pure rollout edits: start / complete / halt / resume stages, record readings, CSV import,
// mark stage messages sent. Same contract as lib/edit.ts: new doc, updatedAt bumped, decisions logged.

import { completePhase, logDecision } from "./edit";
import { incrementOf, stageGate } from "./launch-status";
import type { LaunchDoc, MetricReading, RolloutPercent, RolloutStage } from "./types";

function setStage(doc: LaunchDoc, cumulative: RolloutPercent, patch: Partial<RolloutStage>, now: Date): LaunchDoc {
  const stages = doc.rollout.stages.map((s) => (s.cumulative === cumulative ? { ...s, ...patch } : s)) as LaunchDoc["rollout"]["stages"];
  return { ...doc, rollout: { ...doc.rollout, stages }, meta: { ...doc.meta, updatedAt: now.toISOString() } };
}

const stageOf = (doc: LaunchDoc, c: RolloutPercent) => doc.rollout.stages.find((s) => s.cumulative === c)!;

/** Only the first not-started stage can start, and only when no other stage is live or halted. */
export function canStart(doc: LaunchDoc, c: RolloutPercent): boolean {
  const open = doc.rollout.stages.some((s) => s.status === "live" || s.status === "halted");
  const first = doc.rollout.stages.find((s) => s.status === "not-started");
  return !open && first?.cumulative === c;
}

export function startStage(doc: LaunchDoc, c: RolloutPercent, now: Date): LaunchDoc {
  if (!canStart(doc, c)) return doc;
  const next = setStage(doc, c, { status: "live", startedAt: now.toISOString() }, now);
  return logDecision(next, `${c}% rollout stage started (+${incrementOf(c)}% of audience).`, now);
}

/**
 * Completes a live stage. A failing gate needs an explicit override reason, which is logged as a
 * decision and linked from the stage. Completing a stage opens the next one; 100% closes the rollout.
 */
export function completeStage(doc: LaunchDoc, c: RolloutPercent, now: Date, overrideReason?: string): LaunchDoc {
  const stage = stageOf(doc, c);
  if (stage.status !== "live") return doc;
  const gate = stageGate(doc, stage, now);
  let next = doc;
  let overrideDecisionId: string | null = null;
  if (!gate.passes) {
    const reason = overrideReason?.trim();
    if (!reason) return doc;
    next = logDecision(next, `Gate overridden to close the ${c}% stage: ${reason}`, now);
    overrideDecisionId = next.decisions.at(-1)!.id;
  }
  next = setStage(next, c, { status: "complete", completedAt: now.toISOString(), overrideDecisionId }, now);
  if (c === 100) {
    next = logDecision(next, "Rolled out to 100% of the audience.", now);
    return completePhase(next, "rollout", now);
  }
  next = logDecision(next, `${c}% stage complete${gate.passes ? " — no failure metric breached" : ""}.`, now);
  const following = doc.rollout.stages.find((s) => s.cumulative > c)!;
  return startStage(next, following.cumulative, now);
}

export function haltStage(doc: LaunchDoc, c: RolloutPercent, reason: string, now: Date): LaunchDoc {
  if (stageOf(doc, c).status !== "live" || !reason.trim()) return doc;
  return logDecision(setStage(doc, c, { status: "halted" }, now), `${c}% stage halted: ${reason.trim()}`, now);
}

export function resumeStage(doc: LaunchDoc, c: RolloutPercent, now: Date): LaunchDoc {
  if (stageOf(doc, c).status !== "halted") return doc;
  return logDecision(setStage(doc, c, { status: "live" }, now), `${c}% stage resumed.`, now);
}

export function markNotified(doc: LaunchDoc, c: RolloutPercent, now: Date): LaunchDoc {
  const stage = stageOf(doc, c);
  if (stage.status !== "complete" || stage.notifiedAt) return doc;
  return setStage(doc, c, { notifiedAt: now.toISOString() }, now);
}

/** Readings go to the live/halted stage (or a named started stage); unknown metrics are ignored. */
export function addReadings(doc: LaunchDoc, c: RolloutPercent, values: Record<string, number>, now: Date): LaunchDoc {
  const stage = stageOf(doc, c);
  if (stage.status === "not-started") return doc;
  const known = new Set(doc.alignment.metrics.map((m) => m.id));
  const readings: MetricReading[] = Object.entries(values)
    .filter(([id, v]) => known.has(id) && Number.isFinite(v))
    .map(([metricId, value]) => ({ metricId, value, recordedAt: now.toISOString() }));
  if (!readings.length) return doc;
  return setStage(doc, c, { readings: [...stage.readings, ...readings] }, now);
}

export interface CsvResult {
  doc: LaunchDoc;
  imported: number;
  errors: string[];
}

/**
 * CSV import: `stage,metric,value[,recorded_at]` with a header row optional.
 * `stage` is 10/30/60/100 (a trailing % is fine); `metric` is a metric id or its exact name.
 */
export function importReadingsCsv(doc: LaunchDoc, csv: string, now: Date): CsvResult {
  const errors: string[] = [];
  const byName = new Map(doc.alignment.metrics.map((m) => [m.name.toLowerCase(), m.id]));
  const ids = new Set(doc.alignment.metrics.map((m) => m.id));
  const additions = new Map<RolloutPercent, MetricReading[]>();
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /stage/i.test(cells[0])) return; // header
    const [stageRaw, metricRaw, valueRaw, dateRaw] = cells;
    const c = Number(stageRaw?.replace("%", "")) as RolloutPercent;
    const stage = doc.rollout.stages.find((s) => s.cumulative === c);
    const metricId = ids.has(metricRaw) ? metricRaw : byName.get(metricRaw?.toLowerCase() ?? "");
    const value = Number(valueRaw);
    const recordedAt = dateRaw ? new Date(dateRaw) : now;
    if (!stage) return errors.push(`Line ${i + 1}: unknown stage "${stageRaw}".`);
    if (stage.status === "not-started") return errors.push(`Line ${i + 1}: the ${c}% stage hasn't started.`);
    if (!metricId) return errors.push(`Line ${i + 1}: unknown metric "${metricRaw}".`);
    if (valueRaw === undefined || valueRaw === "" || !Number.isFinite(value)) return errors.push(`Line ${i + 1}: "${valueRaw}" is not a number.`);
    if (Number.isNaN(recordedAt.getTime()) || recordedAt.getTime() > now.getTime()) return errors.push(`Line ${i + 1}: invalid or future date.`);
    additions.set(c, [...(additions.get(c) ?? []), { metricId, value, recordedAt: recordedAt.toISOString() }]);
  });
  let next = doc;
  let imported = 0;
  for (const [c, readings] of additions) {
    imported += readings.length;
    next = setStage(next, c, { readings: [...stageOf(next, c).readings, ...readings] }, now);
  }
  return { doc: next, imported, errors };
}
