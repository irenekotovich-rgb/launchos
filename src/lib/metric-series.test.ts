import { describe, expect, it } from "vitest";
import { DEMO_AUTHORED_AT, getDemoLaunch } from "./demo";
import { buildMetricSeries } from "./metric-series";

const NOW = new Date(DEMO_AUTHORED_AT);

describe("buildMetricSeries", () => {
  it("one series per agreed metric, four stage points each", () => {
    const series = buildMetricSeries(getDemoLaunch(NOW));
    expect(series).toHaveLength(5);
    expect(series.every((s) => s.points.length === 4)).toBe(true);
  });
  it("judges state in the live stage, like the gate", () => {
    const tickets = buildMetricSeries(getDemoLaunch(NOW)).find((s) => s.id === "f-tickets")!;
    expect(tickets).toMatchObject({ state: "near", stateStage: 30 });
  });
  it("shows no-data, not the previous stage's health, when the live stage has no readings yet", () => {
    const doc = getDemoLaunch(NOW);
    doc.rollout.stages[1].readings = [];
    const tickets = buildMetricSeries(doc).find((s) => s.id === "f-tickets")!;
    expect(tickets.state).toBe("no-data");
    expect(tickets.points[0].value).toBe(6.2);
  });
  it("ignores readings recorded after a stage closed", () => {
    const doc = getDemoLaunch(NOW);
    const s0 = doc.rollout.stages[0];
    s0.readings.push({ metricId: "f-tickets", value: 99, recordedAt: new Date(Date.parse(s0.completedAt!) + 3_600_000).toISOString() });
    expect(buildMetricSeries(doc).find((s) => s.id === "f-tickets")!.points[0].value).toBe(6.2);
  });
});
