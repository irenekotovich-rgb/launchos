import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { createShare, deleteShare, getShare } = await import("./share-store");
const { DEMO_AUTHORED_AT, getDemoLaunch } = await import("./demo");

const NOW = new Date(DEMO_AUTHORED_AT);
const own = () => ({ ...getDemoLaunch(NOW), meta: { ...getDemoLaunch(NOW).meta, mode: "own" as const } });

describe("share store (in-memory mode)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("distinguishes wrong token from unknown id, and deletes with the right token", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    const { id, deleteToken } = await createShare(own(), NOW);
    expect(await getShare(id, NOW)).not.toBeNull();
    expect(await deleteShare(id, "wrong")).toBe("wrong-token");
    expect(await deleteShare(id, deleteToken)).toBe("deleted");
    expect(await deleteShare(id, deleteToken)).toBe("not-found");
    expect(await getShare(id, NOW)).toBeNull();
  });
  it("expired snapshots read as gone", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "");
    const { id } = await createShare(own(), NOW);
    expect(await getShare(id, new Date(NOW.getTime() + 91 * 86_400_000))).toBeNull();
  });
  it("refuses on Vercel without a Blob token instead of handing out a per-instance link", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("VERCEL", "1");
    await expect(createShare(own(), NOW)).rejects.toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});
