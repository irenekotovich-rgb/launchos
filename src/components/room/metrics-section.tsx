import { Section, EmptyState } from "./section";
import { MetricsDashboard, type MetricSeries } from "./metrics-dashboard";
import { latestReading, metricState } from "@/lib/launch-status";
import type { LaunchDoc } from "@/lib/types";

/** Server side: flatten the doc into plain series; the client component only draws. */
export function MetricsSection({ doc }: { doc: LaunchDoc }) {
  const series: MetricSeries[] = doc.alignment.metrics.map((m) => {
    const points = doc.rollout.stages.map((s) => {
      const r = latestReading(s, m.id);
      return { stage: s.cumulative, value: r?.value ?? null, recordedAt: r?.recordedAt ?? null };
    });
    const last = [...points].reverse().find((p) => p.value !== null);
    return {
      id: m.id,
      name: m.name,
      kind: m.kind,
      unit: m.unit,
      direction: m.direction,
      threshold: m.threshold,
      owner: m.owner,
      points,
      state: metricState(m, last?.value ?? undefined),
      lastStage: last?.stage ?? null,
    };
  });
  return (
    <Section id="metrics" title="Metrics dashboard" kicker="Agreed in alignment · latest reading per rollout stage">
      {series.length === 0 ? (
        <EmptyState>No metrics agreed yet. Success and failure metrics come from the alignment stage.</EmptyState>
      ) : (
        <MetricsDashboard series={series} />
      )}
    </Section>
  );
}
