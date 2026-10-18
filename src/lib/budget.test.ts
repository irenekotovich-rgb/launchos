import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { dailyLimit, reserveRun } = await import("./budget");

describe("daily live-run budget (in-memory mode, no Blob token)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("defaults to 25 and treats 0 as unlimited", () => {
    expect(dailyLimit({} as NodeJS.ProcessEnv)).toBe(25);
    expect(dailyLimit({ LAUNCHOS_DAILY_LIVE_RUNS: "0" } as unknown as NodeJS.ProcessEnv)).toBe(0);
    expect(dailyLimit({ LAUNCHOS_DAILY_LIVE_RUNS: "abc" } as unknown as NodeJS.ProcessEnv)).toBe(25);
  });
  it("allows runs up to the limit, then refuses until the next UTC day", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("LAUNCHOS_DAILY_LIVE_RUNS", "2");
    const day = new Date("2030-01-01T10:00:00Z");
    expect((await reserveRun(day)).allowed).toBe(true);
    expect((await reserveRun(day)).allowed).toBe(true);
    expect(await reserveRun(day)).toMatchObject({ allowed: false, used: 2, limit: 2 });
    expect((await reserveRun(new Date("2030-01-02T00:00:01Z"))).allowed).toBe(true);
  });
});
