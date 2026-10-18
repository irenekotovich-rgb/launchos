// Daily live-run budget guard (CLAUDE.md, PRD §5): the hosted demo must never die on a rate
// limit or drain the free-tier quota. Each full generation counts as one run.
//
// Two layers:
//  1. Per-client throttle (in memory, per warm instance): stops a single client looping the
//     endpoint, which the soft daily cap alone can't (its read-modify-write can race).
//  2. Daily cap: a JSON counter per UTC day in the private Vercel Blob store when
//     BLOB_READ_WRITE_TOKEN is set (hosted), otherwise in memory (local dev / forks).
//     Fails CLOSED when a token is configured but storage errors — a broken counter must not
//     switch the guard off on the public demo.
import "server-only";
import { BlobNotFoundError, get, put } from "@vercel/blob";

/** Runs per UTC day. 0 = unlimited (self-hosted forks on their own keys). */
export function dailyLimit(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.LAUNCHOS_DAILY_LIVE_RUNS;
  if (raw === undefined || raw === "") return 25;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 25;
}

/** Runs per client per rolling hour (0 = off). */
export function clientLimit(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.LAUNCHOS_RUNS_PER_CLIENT_HOUR ?? 3);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3;
}

const HOUR = 3_600_000;
const memory = new Map<string, number>();
const clientRuns = new Map<string, number[]>();
const dayKey = (now: Date) => `budget/${now.toISOString().slice(0, 10)}.json`;

async function readCount(key: string): Promise<number> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memory.get(key) ?? 0;
  try {
    const res = await get(key, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return 0;
    const json = JSON.parse(await new Response(res.stream).text()) as { runs?: unknown };
    if (typeof json.runs !== "number" || !Number.isFinite(json.runs)) throw new Error("corrupt budget counter");
    return json.runs;
  } catch (err) {
    if (err instanceof BlobNotFoundError) return 0;
    throw err;
  }
}

async function writeCount(key: string, runs: number) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    memory.set(key, runs);
    return;
  }
  await put(key, JSON.stringify({ runs }), {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json",
  });
}

export type BudgetCheck =
  | { allowed: true; used: number; limit: number }
  | { allowed: false; reason: "daily" | "client" | "storage"; used: number; limit: number };

export async function reserveRun(now: Date = new Date(), client = "anonymous"): Promise<BudgetCheck> {
  const perClient = clientLimit();
  if (perClient > 0) {
    const recent = (clientRuns.get(client) ?? []).filter((t) => now.getTime() - t < HOUR);
    if (recent.length >= perClient) return { allowed: false, reason: "client", used: recent.length, limit: perClient };
    clientRuns.set(client, [...recent, now.getTime()]);
  }

  const limit = dailyLimit();
  if (limit === 0) return { allowed: true, used: 0, limit };
  const key = dayKey(now);
  try {
    const used = await readCount(key);
    if (used >= limit) return { allowed: false, reason: "daily", used, limit };
    await writeCount(key, used + 1);
    return { allowed: true, used: used + 1, limit };
  } catch (err) {
    console.error("[budget] counter unavailable — refusing live runs (fail closed)", err);
    return { allowed: false, reason: "storage", used: -1, limit };
  }
}

/** Gives a run back when it produced nothing (every model failed). Best effort. */
export async function refundRun(now: Date = new Date(), client = "anonymous"): Promise<void> {
  const recent = clientRuns.get(client);
  if (recent?.length) recent.pop();
  if (dailyLimit() === 0) return;
  try {
    const key = dayKey(now);
    const used = await readCount(key);
    if (used > 0) await writeCount(key, used - 1);
  } catch {
    /* refund is best effort */
  }
}
