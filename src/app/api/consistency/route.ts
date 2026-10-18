// POST /api/consistency — run the fixed rubric over the asset kit; findings per asset.
import { NextResponse } from "next/server";
import { checkConsistency } from "@/lib/ai/consistency";
import { fail, parseBody, reserve, type Failure } from "@/lib/ai/route-guard";
import { RUN_COST } from "@/lib/budget";
import { consistencyRequest } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

export type ConsistencyResponse = { status: "ok"; result: Awaited<ReturnType<typeof checkConsistency>> } | Failure;

export async function POST(req: Request) {
  const body = await parseBody(req, consistencyRequest);
  if (!body.ok) return body.res;
  const slot = await reserve(req, RUN_COST.check);
  if (!slot.ok) return slot.res;
  try {
    return NextResponse.json<ConsistencyResponse>({ status: "ok", result: await checkConsistency(body.data) });
  } catch (err) {
    await slot.refund();
    console.warn("[consistency] failed", err);
    return fail({ status: "unavailable", message: "The consistency check couldn't run right now — try again later." });
  }
}
