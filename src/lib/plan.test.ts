import { describe, expect, it } from "vitest";
import { derivePhases, deriveRollout, RUNWAY_DAYS, runwayWarning, suggestTier } from "./plan";
import { runGeneration } from "./pipeline";
import type { LaunchBrief } from "./types";

const DAY = 86_400_000;
const NOW = new Date("2026-10-18T09:00:00.000Z");
const brief = (days: number, claims = 3): LaunchBrief => ({
  productName: "X", what: "w", who: "u", whyNow: "n",
  targetDate: new Date(NOW.getTime() + days * DAY).toISOString(),
  claims: Array.from({ length: claims }, (_, i) => `claim ${i}`),
});

describe("plan derivation", () => {
  it("suggests a tier from claims and runway", () => {
    expect(suggestTier(brief(60, 5), NOW).tier).toBe("T1");
    expect(suggestTier(brief(20, 3), NOW).tier).toBe("T2");
    expect(suggestTier(brief(20, 1), NOW).tier).toBe("T3");
  });

  it("plans six contiguous phases ending on launch day", () => {
    const target = brief(60).targetDate;
    const phases = derivePhases("T2", target, NOW);
    expect(phases.map((p) => p.key)).toEqual(["analysis", "alignment", "brief", "assets", "readiness", "rollout"]);
    expect(phases.at(-1)!.eta).toBe(target);
    expect(Date.parse(target) - Date.parse(phases[0].start)).toBe(RUNWAY_DAYS.T2 * DAY);
    for (let i = 1; i < phases.length; i++) expect(phases[i].start).toBe(phases[i - 1].eta);
  });

  it("compresses instead of backdating when the runway is short", () => {
    const phases = derivePhases("T1", brief(5).targetDate, NOW);
    expect(Date.parse(phases[0].start)).toBe(NOW.getTime());
  });

  it("schedules the 100% stage on launch day", () => {
    const target = brief(30).targetDate;
    const rollout = deriveRollout(derivePhases("T2", target, NOW));
    expect(rollout.stages.map((s) => s.cumulative)).toEqual([10, 30, 60, 100]);
    expect(rollout.stages[3].plannedStart).toBe(target);
  });

  it("runGeneration returns an own, empty-but-planned LaunchDoc", async () => {
    const doc = await runGeneration(brief(30), NOW);
    expect(doc.meta.mode).toBe("own");
    expect(doc.meta.author.name).toBe("Iryna Kotovych");
    expect(Object.keys(doc.alignment.signoffs)).toHaveLength(6);
    expect(doc.assets).toEqual([]);
  });
});

describe("plan guards (review PR #4)", () => {
  it("refuses a launch day at or before now", async () => {
    expect(() => derivePhases("T2", NOW.toISOString(), NOW)).toThrow(RangeError);
    await expect(runGeneration(brief(-1), NOW)).rejects.toThrow(RangeError);
  });
  it("tier boundaries: 4 claims and 35 days make T1", () => {
    expect(suggestTier(brief(35, 4), NOW).tier).toBe("T1");
    expect(suggestTier(brief(34.9, 4), NOW).tier).toBe("T2");
  });
  it("T3 runway is 14 days", () => {
    const phases = derivePhases("T3", brief(60).targetDate, NOW);
    expect(Date.parse(phases[5].eta) - Date.parse(phases[0].start)).toBe(14 * DAY);
  });
  it("warns when the runway is shorter than the tier needs", () => {
    expect(runwayWarning("T1", brief(10).targetDate, NOW)).toMatch(/Runway is 10 days; a T1 launch usually needs 42/);
    expect(runwayWarning("T3", brief(20).targetDate, NOW)).toBeNull();
  });
});
