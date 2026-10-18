// Flattens a LaunchDoc into plain per-metric series for the dashboard (server → client props).
import { latestReading, metricState, type MetricState } from "./launch-status";
import type { LaunchDoc, Metric } from "./types";

export interface MetricSeries {
  id: string;
  name: string;
  kind: Metric["kind"];
  unit: string;
  direction: Metric["direction"];
  threshold: number;
  owner: string;
  points: { stage: number; value: number | null; recordedAt: string | null }[];
  /** State in the current stage (live/halted, else the last completed one) — matches the gate. */
  state: MetricState;
  stateStage: number | null;
}

export function currentMetricStage(doc: LaunchDoc) {
  const open = doc.rollout.stages.find((s) => s.status === "live" || s.status === "halted");
  return open ?? [...doc.rollout.stages].reverse().find((s) => s.status === "complete");
}

export function buildMetricSeries(doc: LaunchDoc): MetricSeries[] {
  const current = currentMetricStage(doc);
  return doc.alignment.metrics.map((m) => {
    const asOf = (s: (typeof doc.rollout.stages)[number]) => (s.completedAt ? new Date(s.completedAt) : undefined);
    const points = doc.rollout.stages.map((s) => {
      const r = latestReading(s, m.id, asOf(s));
      return { stage: s.cumulative, value: r?.value ?? null, recordedAt: r?.recordedAt ?? null };
    });
    const now = current ? points.find((p) => p.stage === current.cumulative) : undefined;
    return {
      id: m.id,
      name: m.name,
      kind: m.kind,
      unit: m.unit,
      direction: m.direction,
      threshold: m.threshold,
      owner: m.owner,
      points,
      state: metricState(m, now?.value ?? undefined),
      stateStage: current?.cumulative ?? null,
    };
  });
}
