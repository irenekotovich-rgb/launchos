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
  // One completion line for both paths, so the log reads the same whether the gate passed or was overridden.
  next = logDecision(next, `${c}% stage complete — ${gate.passes ? "gate passed, no failure metric breached" : "gate overridden"}.`, now);
  if (c === 100) {
    next = logDecision(next, "Rolled out to 100% of the audience.", now);
    return completePhase(next, "rollout", now);
  }
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
  duplicates: number;
  errors: string[];
}

/** Splits one CSV line, honouring double quotes ("Tickets, per 1k" stays one cell; "" escapes a quote). */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

const STAGE_CELL = /^(10|30|60|100)%?$/;
const NUMBER_CELL = /^-?\d+(\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * CSV import: `stage,metric,value[,recorded_at]`, header row optional.
 * - stage: 10/30/60/100 (trailing % fine) · metric: id (exact) or name (case-insensitive)
 * - value: plain decimal with a dot (`9.4`, not `9,4`) · recorded_at: ISO date, within the stage
 * Line numbers in errors are file lines. Identical rows already recorded are skipped.
 */
export function importReadingsCsv(doc: LaunchDoc, csv: string, now: Date): CsvResult {
  const errors: string[] = [];
  const ids = new Set(doc.alignment.metrics.map((m) => m.id));
  const byName = new Map<string, string | null>();
  for (const m of doc.alignment.metrics) {
    const k = m.name.toLowerCase();
    byName.set(k, byName.has(k) ? null : m.id); // ambiguous names (case-only difference) can't be used
  }
  const additions = new Map<RolloutPercent, MetricReading[]>();
  let duplicates = 0;
  const seen = new Set(
    doc.rollout.stages.flatMap((s) => s.readings.map((r) => `${s.cumulative}|${r.metricId}|${r.value}|${Date.parse(r.recordedAt)}`)),
  );
  const lines = csv.split(/\r?\n/).map((text, i) => ({ text: text.trim(), no: i + 1 })).filter((l) => l.text);
  lines.forEach(({ text, no }, idx) => {
    const cells = splitCsvLine(text);
    if (idx === 0 && /^stage$/i.test(cells[0])) return; // header
    const err = (m: string) => void errors.push(`Line ${no}: ${m}`);
    if (cells.length < 3 || cells.length > 4) return err(`expected 3–4 columns, got ${cells.length} (use a dot for decimals, quote names with commas).`);
    const [stageRaw, metricRaw, valueRaw, dateRaw] = cells;
    if (!STAGE_CELL.test(stageRaw)) return err(`unknown stage "${stageRaw}".`);
    const c = Number(stageRaw.replace("%", "")) as RolloutPercent;
    const stage = doc.rollout.stages.find((s) => s.cumulative === c)!;
    if (stage.status === "not-started" || !stage.startedAt) return err(`the ${c}% stage hasn't started.`);
    const metricId = ids.has(metricRaw) ? metricRaw : byName.get(metricRaw.toLowerCase());
    if (metricId === null) return err(`metric name "${metricRaw}" is ambiguous — use its id.`);
    if (!metricId) return err(`unknown metric "${metricRaw}".`);
    if (!NUMBER_CELL.test(valueRaw)) return err(`"${valueRaw}" is not a number (use a dot for decimals).`);
    let recordedAt = now;
    if (dateRaw) {
      if (!ISO_DATE.test(dateRaw) || Number.isNaN(Date.parse(dateRaw))) return err(`"${dateRaw}" is not an ISO date (YYYY-MM-DD).`);
      recordedAt = new Date(dateRaw);
      if (recordedAt.getTime() > now.getTime()) return err("date is in the future.");
      if (recordedAt.getTime() < Date.parse(stage.startedAt)) return err(`date is before the ${c}% stage started.`);
    }
    const value = Number(valueRaw);
    const key = `${c}|${metricId}|${value}|${recordedAt.getTime()}`;
    if (seen.has(key)) return void duplicates++;
    seen.add(key);
    additions.set(c, [...(additions.get(c) ?? []), { metricId, value, recordedAt: recordedAt.toISOString() }]);
  });
  let next = doc;
  let imported = 0;
  for (const [c, readings] of additions) {
    imported += readings.length;
    next = setStage(next, c, { readings: [...stageOf(next, c).readings, ...readings] }, now);
  }
  return { doc: next, imported, duplicates, errors };
}
