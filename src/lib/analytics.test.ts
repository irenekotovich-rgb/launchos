import { describe, expect, it, vi } from "vitest";

vi.mock("posthog-js", () => ({ default: { init: vi.fn(), capture: vi.fn() } }));

describe("analytics", () => {
  it("is a no-op without NEXT_PUBLIC_POSTHOG_KEY (forks and local runs send nothing)", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "");
    const posthog = (await import("posthog-js")).default;
    const { initAnalytics, track } = await import("./analytics");
    initAnalytics();
    track("demo_opened");
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("event names match docs/metrics.md exactly", async () => {
    const { readFileSync } = await import("node:fs");
    const doc = readFileSync("docs/metrics.md", "utf8");
    const src = readFileSync("src/lib/analytics.ts", "utf8");
    const names = [...src.matchAll(/\| "([a-z_]+)"/g)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(10);
    for (const n of names) expect(doc).toContain("`" + n + "`");
  });

  it("URLs are reduced to route templates — share ids never leave the browser", async () => {
    const { templatePath } = await import("./analytics");
    expect(templatePath("https://launchos.app/share/AbCdEfGhIjKlMnOpQrStUvWxYz012345/analysis/context?x=1#h")).toBe("https://launchos.app/share/[id]/analysis/context");
    expect(templatePath("/launch/9f1c2b7e-1111/analysis/economics")).toBe("/launch/[id]/analysis/economics");
    expect(templatePath("https://launchos.app/demo")).toBe("https://launchos.app/demo");
  });
});

describe("suggestion kinds are content-free", async () => {
  const { bottlenecks } = await import("./launch-status");
  const { DEMO_AUTHORED_AT, getDemoLaunch } = await import("./demo");
  const ALLOWED = ["phase-overdue", "alignment-open", "stage-halted", "no-failure-metrics", "metric-breached", "metric-near", "readings-stale", "stage-late", "assets-stale", "checklist-open"];
  it("every kind the generator emits is in the allow-list", () => {
    const now = new Date(DEMO_AUTHORED_AT + 80 * 86_400_000);
    const doc = getDemoLaunch(new Date(DEMO_AUTHORED_AT));
    doc.rollout.stages[1].status = "halted";
    doc.alignment.lockedAt = null;
    doc.alignment.signoffs.legal.status = "objected";
    for (const s of bottlenecks(doc, now)) expect(ALLOWED).toContain(s.kind);
  });
});
