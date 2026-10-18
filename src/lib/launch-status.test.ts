import { describe, expect, it } from "vitest";
import { DEMO_AUTHORED_AT, getDemoLaunch, shiftDates } from "./demo";
import {
  bottlenecks,
  countdown,
  currentPhase,
  metricState,
  projectedEndDate,
  rolledOutPercent,
  stageGate,
} from "./launch-status";
import type { LaunchDoc, Metric } from "./types";

const NOW = new Date(DEMO_AUTHORED_AT);
const demo = (): LaunchDoc => getDemoLaunch(NOW);

const failure: Metric = {
  id: "f", kind: "failure", name: "Tickets", unit: "", direction: "above", threshold: 10, owner: "x",
};
const success: Metric = { ...failure, id: "s", kind: "success", direction: "below", threshold: 4 };

describe("metricState", () => {
  it("classifies failure metrics against the threshold", () => {
    expect(metricState(failure, 5)).toBe("ok");
    expect(metricState(failure, 9.2)).toBe("near");
    expect(metricState(failure, 10)).toBe("breached");
    expect(metricState(failure, undefined)).toBe("no-data");
  });
  it("classifies success metrics as met / not met", () => {
    expect(metricState(success, 3.5)).toBe("met");
    expect(metricState(success, 4.3)).toBe("not-met");
  });
});

describe("demo launch", () => {
  it("is labeled demo and authored by the owner", () => {
    const doc = demo();
    expect(doc.meta.mode).toBe("demo");
    expect(doc.meta.author.name).toBe("Iryna Kotovych");
    expect(doc.brief.productName).toBe("Launch Service");
  });

  it("sits mid-rollout at 30% with launch day 9 days out", () => {
    const doc = demo();
    expect(currentPhase(doc)?.key).toBe("rollout");
    expect(rolledOutPercent(doc)).toBe(30);
    const c = countdown(projectedEndDate(doc, NOW), NOW);
    expect(c).toMatchObject({ days: 9, hours: 0, past: false });
  });

  it("keeps the same shape on any day (dates shift together)", () => {
    const later = new Date(DEMO_AUTHORED_AT + 40 * 86_400_000);
    const doc = getDemoLaunch(later);
    expect(countdown(projectedEndDate(doc, later), later).days).toBe(9);
  });

  it("passes the 30% gate but warns that tickets are near the threshold", () => {
    const doc = demo();
    const gate = stageGate(doc, doc.rollout.stages[1], NOW);
    expect(gate.passes).toBe(true);
    expect(gate.near.map((m) => m.id)).toEqual(["f-tickets"]);
  });

  it("surfaces the stale one-pager and the ticket trend as suggestions", () => {
    const ids = bottlenecks(demo(), NOW).map((s) => s.id);
    expect(ids).toContain("assets-stale");
    expect(ids).toContain("metric-near-f-tickets");
    expect(ids).not.toContain("alignment-open");
  });
});

describe("gates and dates", () => {
  it("fails the gate when readings are older than 48h", () => {
    const doc = demo();
    const threeDaysLater = new Date(DEMO_AUTHORED_AT + 3 * 86_400_000);
    const gate = stageGate(doc, doc.rollout.stages[1], threeDaysLater);
    expect(gate.passes).toBe(false);
    expect(gate.stale).toHaveLength(3);
  });

  it("pushes launch day back by the current phase's slip", () => {
    const doc = demo();
    const twoDaysLate = new Date(Date.parse(currentPhase(doc)!.eta) + 2 * 86_400_000);
    const projected = projectedEndDate(doc, twoDaysLate);
    expect(projected.getTime() - Date.parse(doc.brief.targetDate)).toBe(2 * 86_400_000);
  });

  it("shiftDates moves ISO strings only", () => {
    const out = shiftDates({ a: "2026-01-01T00:00:00.000Z", b: "not a date", c: [1] }, 1000);
    expect(out).toEqual({ a: "2026-01-01T00:00:01.000Z", b: "not a date", c: [1] });
  });
});
