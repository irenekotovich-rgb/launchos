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

describe("budget guard hardening (review PR #7)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("throttles a single client per hour", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("LAUNCHOS_DAILY_LIVE_RUNS", "0");
    vi.stubEnv("LAUNCHOS_RUNS_PER_CLIENT_HOUR", "2");
    const t = new Date("2031-05-05T10:00:00Z");
    expect((await reserveRun(t, "1.2.3.4")).allowed).toBe(true);
    expect((await reserveRun(t, "1.2.3.4")).allowed).toBe(true);
    expect(await reserveRun(t, "1.2.3.4")).toMatchObject({ allowed: false, reason: "client" });
    expect((await reserveRun(t, "5.6.7.8")).allowed).toBe(true);
    expect((await reserveRun(new Date(t.getTime() + 3_700_000), "1.2.3.4")).allowed).toBe(true);
  });
  it("fails closed when a Blob token is set but storage errors", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_invalid_token_for_test");
    vi.stubEnv("LAUNCHOS_DAILY_LIVE_RUNS", "5");
    vi.stubEnv("LAUNCHOS_RUNS_PER_CLIENT_HOUR", "0");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await reserveRun(new Date("2031-06-06T10:00:00Z"), "x");
    expect(res).toMatchObject({ allowed: false, reason: "storage" });
    spy.mockRestore();
  }, 20_000);
});
