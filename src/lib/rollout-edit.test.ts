import { describe, expect, it } from "vitest";
import { DEMO_AUTHORED_AT, getDemoLaunch } from "./demo";
import { buildPlanDoc } from "./pipeline";
import * as R from "./rollout-edit";

const NOW = new Date(DEMO_AUTHORED_AT);
const demo = () => {
  const d = getDemoLaunch(NOW);
  d.meta.mode = "own";
  return d;
};

describe("rollout edits", () => {
  it("starts only the first stage, once", () => {
    const doc = buildPlanDoc({ productName: "X", what: "w", who: "u", whyNow: "n", targetDate: "2026-12-01T09:00:00.000Z", claims: ["a"] }, NOW);
    expect(R.canStart(doc, 30)).toBe(false);
    const started = R.startStage(doc, 10, NOW);
    expect(started.rollout.stages[0]).toMatchObject({ status: "live", startedAt: NOW.toISOString() });
    expect(R.startStage(started, 10, NOW)).toBe(started);
  });

  it("completing a passing stage opens the next and logs both", () => {
    const next = R.completeStage(demo(), 30, NOW);
    expect(next.rollout.stages[1]).toMatchObject({ status: "complete", overrideDecisionId: null });
    expect(next.rollout.stages[2].status).toBe("live");
    expect(next.decisions.slice(-2).map((d) => d.text)).toEqual([
      "30% stage complete — no failure metric breached.",
      "60% rollout stage started (+30% of audience).",
    ]);
  });

  it("a failing gate needs an override reason, which is logged and linked", () => {
    const doc = demo();
    doc.rollout.stages[1].readings.push({ metricId: "f-tickets", value: 14, recordedAt: NOW.toISOString() });
    expect(R.completeStage(doc, 30, NOW)).toBe(doc);
    const forced = R.completeStage(doc, 30, NOW, "Spike traced to one customer's misconfiguration");
    const id = forced.rollout.stages[1].overrideDecisionId;
    expect(forced.decisions.find((d) => d.id === id)?.text).toMatch(/Gate overridden to close the 30% stage: Spike traced/);
  });

  it("closing 100% flags the rollout and closes the phase", () => {
    let doc = demo();
    doc = R.completeStage(doc, 30, NOW);
    doc = R.addReadings(doc, 60, { "f-tickets": 8, "f-rollbacks": 0.5, "f-latency": 1000 }, NOW);
    doc = R.completeStage(doc, 60, NOW);
    doc = R.addReadings(doc, 100, { "f-tickets": 7, "f-rollbacks": 0.4, "f-latency": 990 }, NOW);
    doc = R.completeStage(doc, 100, NOW);
    expect(doc.rollout.stages.every((s) => s.status === "complete")).toBe(true);
    expect(doc.phases.find((p) => p.key === "rollout")?.completedAt).toBe(NOW.toISOString());
    expect(doc.decisions.map((d) => d.text)).toContain("Rolled out to 100% of the audience.");
  });

  it("halt needs a reason; resume reopens", () => {
    const doc = demo();
    expect(R.haltStage(doc, 30, " ", NOW)).toBe(doc);
    const halted = R.haltStage(doc, 30, "Rollback spike", NOW);
    expect(halted.rollout.stages[1].status).toBe("halted");
    expect(R.resumeStage(halted, 30, NOW).rollout.stages[1].status).toBe("live");
  });

  it("marks a completed stage's message as sent once", () => {
    const doc = demo();
    expect(R.markNotified(doc, 30, NOW)).toBe(doc); // live, not complete
    const done = R.completeStage(doc, 30, NOW);
    const marked = R.markNotified(done, 30, NOW);
    expect(marked.rollout.stages[1].notifiedAt).toBe(NOW.toISOString());
    expect(R.markNotified(marked, 30, NOW)).toBe(marked);
  });

  it("readings ignore unknown metrics and non-started stages", () => {
    const doc = demo();
    expect(R.addReadings(doc, 60, { "f-tickets": 1 }, NOW)).toBe(doc);
    expect(R.addReadings(doc, 30, { nope: 1 }, NOW)).toBe(doc);
    expect(R.addReadings(doc, 30, { "f-tickets": 11 }, NOW).rollout.stages[1].readings.at(-1)?.value).toBe(11);
  });

  it("CSV import by id or name, with per-line errors", () => {
    const csv = [
      "stage,metric,value,recorded_at",
      "30%,f-tickets,11.2",
      "30,Median release approval time,4.1,2026-10-18T07:00:00Z",
      "60,f-tickets,3",
      "30,unknown metric,1",
      "30,f-latency,fast",
      "40,f-latency,900",
    ].join("\n");
    const res = R.importReadingsCsv(demo(), csv, NOW);
    expect(res.imported).toBe(2);
    expect(res.errors).toEqual([
      "Line 4: the 60% stage hasn't started.",
      'Line 5: unknown metric "unknown metric".',
      'Line 6: "fast" is not a number.',
      'Line 7: unknown stage "40".',
    ]);
    expect(res.doc.rollout.stages[1].readings.slice(-2).map((r) => r.metricId)).toEqual(["f-tickets", "s-approval-time"]);
  });
});
