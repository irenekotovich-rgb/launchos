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

describe("weighted costs (review PR #9)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("six regenerations cost one full run", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("LAUNCHOS_DAILY_LIVE_RUNS", "1");
    vi.stubEnv("LAUNCHOS_RUNS_PER_CLIENT_HOUR", "0");
    const { RUN_COST } = await import("./budget");
    const day = new Date("2032-03-03T10:00:00Z");
    for (let i = 0; i < 6; i++) expect((await reserveRun(day, "c", RUN_COST.asset)).allowed).toBe(true);
    expect((await reserveRun(day, "c", RUN_COST.asset)).allowed).toBe(false);
  });
});

describe("reservations (repo audit)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("a daily-cap denial doesn't spend the client's hourly quota", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("LAUNCHOS_DAILY_LIVE_RUNS", "1");
    vi.stubEnv("LAUNCHOS_RUNS_PER_CLIENT_HOUR", "2");
    const day = new Date("2033-01-01T10:00:00Z");
    expect((await reserveRun(day, "other")).allowed).toBe(true); // uses the whole daily cap
    expect(await reserveRun(day, "victim")).toMatchObject({ allowed: false, reason: "daily" });
    vi.stubEnv("LAUNCHOS_DAILY_LIVE_RUNS", "0");
    expect((await reserveRun(day, "victim")).allowed).toBe(true);
    expect((await reserveRun(day, "victim")).allowed).toBe(true); // both hourly runs still available
  });
  it("refund removes exactly the failed reservation", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("LAUNCHOS_DAILY_LIVE_RUNS", "0");
    vi.stubEnv("LAUNCHOS_RUNS_PER_CLIENT_HOUR", "2");
    const { refundRun, RUN_COST } = await import("./budget");
    const t = new Date("2033-02-02T10:00:00Z");
    const big = await reserveRun(t, "c", RUN_COST.generate);
    const small = await reserveRun(t, "c", RUN_COST.check);
    expect(big.allowed && small.allowed).toBe(true);
    if (big.allowed) await refundRun(t, "c", RUN_COST.generate, big.reservation); // the generate failed
    // Correct refund leaves 1/6 spent: a new generate (→ 1.17) and a check (→ 1.33) both fit under 2.
    // Popping the wrong entry would leave 1 spent, and the check would be refused at 2.17.
    expect((await reserveRun(t, "c", RUN_COST.generate)).allowed).toBe(true);
    expect((await reserveRun(t, "c", RUN_COST.check)).allowed).toBe(true);
  });
});
