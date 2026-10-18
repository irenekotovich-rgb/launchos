import { Section, EmptyState } from "./section";
import { ReadingsForm } from "./editors";
import { MetricsDashboard } from "./metrics-dashboard";
import { buildMetricSeries } from "@/lib/metric-series";
import type { LaunchDoc } from "@/lib/types";

/** Server side: flatten the doc into plain series; the client component only draws. */
export function MetricsSection({ doc, editable = false }: { doc: LaunchDoc; editable?: boolean }) {
  const series = buildMetricSeries(doc);
  return (
    <Section id="metrics" title="Metrics dashboard" kicker="Agreed in alignment · latest reading per rollout stage">
      {editable && <ReadingsForm />}
      {series.length === 0 ? (
        <EmptyState>No metrics agreed yet. Success and failure metrics come from the alignment stage.</EmptyState>
      ) : (
        <MetricsDashboard series={series} />
      )}
    </Section>
  );
}
