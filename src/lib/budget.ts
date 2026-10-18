// Daily live-run budget guard (CLAUDE.md, PRD §5): the hosted demo must never die on a rate
// limit or run up a bill. Each full generation counts as one run.
//
// Storage: a tiny JSON counter per UTC day in the project's private Vercel Blob store when
// BLOB_READ_WRITE_TOKEN is set (hosted); otherwise an in-memory counter (local dev / forks).
// Concurrent requests can race and overshoot by a run or two — acceptable for a soft cap.
import "server-only";
import { BlobNotFoundError, get, put } from "@vercel/blob";

/** Runs per UTC day. 0 = unlimited (self-hosted forks on their own keys). */
export function dailyLimit(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.LAUNCHOS_DAILY_LIVE_RUNS;
  if (raw === undefined || raw === "") return 25;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 25;
}

const memory = new Map<string, number>();
const dayKey = (now: Date) => `budget/${now.toISOString().slice(0, 10)}.json`;

async function readCount(key: string): Promise<number> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return memory.get(key) ?? 0;
  try {
    const res = await get(key, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return 0;
    const json = JSON.parse(await new Response(res.stream).text()) as { runs?: number };
    return json.runs ?? 0;
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

export interface BudgetCheck {
  allowed: boolean;
  used: number;
  limit: number;
}

/** Reserves one run if the day's budget allows it. Fails open on storage errors, so a Blob outage doesn't block the demo. */
export async function reserveRun(now: Date = new Date()): Promise<BudgetCheck> {
  const limit = dailyLimit();
  if (limit === 0) return { allowed: true, used: 0, limit };
  const key = dayKey(now);
  try {
    const used = await readCount(key);
    if (used >= limit) return { allowed: false, used, limit };
    await writeCount(key, used + 1);
    return { allowed: true, used: used + 1, limit };
  } catch {
    return { allowed: true, used: -1, limit };
  }
}
