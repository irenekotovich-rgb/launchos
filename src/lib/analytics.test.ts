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
});
