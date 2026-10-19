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
  // An empty value (as copied from .env.example) means "default", not 0 = off.
  const raw = env.LAUNCHOS_RUNS_PER_CLIENT_HOUR;
  if (raw === undefined || raw.trim() === "") return 3;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3;
}

const HOUR = 3_600_000;
const memory = new Map<string, number>();
const clientRuns = new Map<string, { id: number; t: number; cost: number }[]>();
let nextReservation = 1;

/** Cost in "runs": a full generation is ~9 model calls; a check or one regenerated asset is ~1. */
export const RUN_COST = { generate: 1, asset: 1 / 6, check: 1 / 6 } as const;
const round = (n: number) => Math.round(n * 1000) / 1000;
// Comparisons allow 0.01 slack: rounded sixths (0.167…) must still add up to one run.
const dayKey = (now: Date) => `budget/${now.toISOString().slice(0, 10)}.json`;

async function readCount(key: string): Promise<number> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memory.get(key) ?? 0;
  try {
    const res = await get(key, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return 0;
    const json = JSON.parse(await new Response(res.stream).text()) as { runs?: unknown };
    if (typeof json.runs !== "number" || !Number.isFinite(json.runs) || json.runs < 0) throw new Error("corrupt budget counter");
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
  | { allowed: true; used: number; limit: number; reservation: number }
  | { allowed: false; reason: "daily" | "client" | "storage"; used: number; limit: number };

export async function reserveRun(now: Date = new Date(), client = "anonymous", cost: number = RUN_COST.generate): Promise<BudgetCheck> {
  const perClient = clientLimit();
  const recent = (clientRuns.get(client) ?? []).filter((r) => now.getTime() - r.t < HOUR);
  if (perClient > 0) {
    const spent = round(recent.reduce((sum, r) => sum + r.cost, 0));
    if (spent + cost > perClient + 0.01) return { allowed: false, reason: "client", used: spent, limit: perClient };
  }
  // The client entry is recorded only once the daily check passes, so a denied request
  // (daily cap, storage outage) doesn't spend the client's hourly quota.
  const reservation = nextReservation++;
  const record = () => {
    if (perClient > 0) clientRuns.set(client, [...recent, { id: reservation, t: now.getTime(), cost }]);
  };

  const limit = dailyLimit();
  if (limit === 0) {
    record();
    return { allowed: true, used: 0, limit, reservation };
  }
  const key = dayKey(now);
  try {
    const used = await readCount(key);
    if (used + cost > limit + 0.01) return { allowed: false, reason: "daily", used, limit };
    await writeCount(key, round(used + cost));
    record();
    return { allowed: true, used: round(used + cost), limit, reservation };
  } catch (err) {
    console.error("[budget] counter unavailable — refusing live runs (fail closed)", err);
    return { allowed: false, reason: "storage", used: -1, limit };
  }
}

/** Gives a run back when it produced nothing (every model failed): removes exactly that reservation. Best effort. */
export async function refundRun(now: Date = new Date(), client = "anonymous", cost: number = RUN_COST.generate, reservation?: number): Promise<void> {
  const entries = clientRuns.get(client);
  if (entries && reservation !== undefined) clientRuns.set(client, entries.filter((r) => r.id !== reservation));
  if (dailyLimit() === 0) return;
  try {
    const key = dayKey(now);
    const used = await readCount(key);
    if (used > 0) await writeCount(key, Math.max(0, round(used - cost)));
  } catch {
    /* refund is best effort */
  }
}
