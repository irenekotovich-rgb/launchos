import { describe, expect, it } from "vitest";
import { DEMO_AUTHORED_AT, getDemoLaunch, shiftDates } from "./demo";
import {
  activeStage,
  bottlenecks,
  countdown,
  currentPhase,
  latestReading,
  metricState,
  projectedEndDate,
  rolledOutPercent,
  stageGate,
} from "./launch-status";
import { ROLLOUT_STEPS } from "./types";
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

describe("demo fixture invariants (JSON is only cast, so check its shape)", () => {
  const doc = demo();
  it("has unique ids and resolvable references", () => {
    const metricIds = new Set(doc.alignment.metrics.map((m) => m.id));
    const assetIds = new Set(doc.assets.map((a) => a.id));
    expect(metricIds.size).toBe(doc.alignment.metrics.length);
    expect(assetIds.size).toBe(doc.assets.length);
    for (const stage of doc.rollout.stages)
      for (const r of stage.readings) expect(metricIds).toContain(r.metricId);
    for (const f of doc.findings) expect(assetIds).toContain(f.assetId);
  });
  it("has all six teams and the four rollout steps in order", () => {
    expect(Object.keys(doc.alignment.signoffs).sort()).toEqual(
      ["legal", "marketing", "rnd", "sales", "stakeholders", "support"],
    );
    expect(doc.rollout.stages.map((s) => s.cumulative)).toEqual(ROLLOUT_STEPS.map((s) => s.cumulative));
  });
  it("keeps status and timestamps consistent", () => {
    for (const s of doc.rollout.stages) {
      expect(s.status === "complete").toBe(s.completedAt !== null);
      expect(s.status === "not-started").toBe(s.startedAt === null);
    }
  });
});

describe("review follow-ups", () => {
  it("latestReading compares parsed times, not strings", () => {
    const stage = { ...demo().rollout.stages[0], readings: [
      { metricId: "m", value: 1, recordedAt: "2026-10-18T10:00:00Z" },
      { metricId: "m", value: 2, recordedAt: "2026-10-18T10:00:00.500Z" },
    ] };
    expect(latestReading(stage, "m")?.value).toBe(2);
  });

  it("fails the gate on missing readings and when no failure metrics exist", () => {
    const doc = demo();
    const gate = stageGate(doc, doc.rollout.stages[2], NOW);
    expect(gate.passes).toBe(false);
    expect(gate.missing).toHaveLength(3);
    doc.alignment.metrics = doc.alignment.metrics.filter((m) => m.kind === "success");
    const empty = stageGate(doc, doc.rollout.stages[1], NOW);
    expect(empty).toMatchObject({ passes: false, noFailureMetrics: true });
  });

  it("warns first when a stage is halted", () => {
    const doc = demo();
    doc.rollout.stages[1].status = "halted";
    expect(activeStage(doc)?.cumulative).toBe(30);
    expect(bottlenecks(doc, NOW)[0].id).toBe("stage-halted-30");
  });

  it("flags a stage whose planned start has passed", () => {
    const doc = demo();
    const afterPlanned = new Date(Date.parse(doc.rollout.stages[2].plannedStart) + 3_600_000);
    expect(bottlenecks(doc, afterPlanned).map((s) => s.id)).toContain("stage-late-60");
  });

  it("keeps a late close visible after the phase closes", () => {
    const doc = demo();
    const rollout = doc.phases.find((p) => p.key === "rollout")!;
    const readiness = doc.phases.find((p) => p.key === "readiness")!;
    rollout.completedAt = null;
    readiness.completedAt = new Date(Date.parse(readiness.eta) + 2 * 86_400_000).toISOString();
    const projected = projectedEndDate(doc, NOW);
    expect(projected.getTime() - Date.parse(doc.brief.targetDate)).toBe(2 * 86_400_000);
  });
});
