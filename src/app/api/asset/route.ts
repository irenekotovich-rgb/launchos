// POST /api/asset — regenerate one asset from the same brief + messaging block.
import { NextResponse } from "next/server";
import { generateAsset } from "@/lib/ai/generate";
import { fail, parseBody, reserve, type Failure } from "@/lib/ai/route-guard";
import { RUN_COST } from "@/lib/budget";
import { assetRequest } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

export type AssetResponse = { status: "ok"; result: Awaited<ReturnType<typeof generateAsset>> } | Failure;

export async function POST(req: Request) {
  const body = await parseBody(req, assetRequest, 16_000);
  if (!body.ok) return body.res;
  const slot = await reserve(req, RUN_COST.asset);
  if (!slot.ok) return slot.res;
  try {
    const { brief, messaging, type } = body.data;
    return NextResponse.json<AssetResponse>({ status: "ok", result: await generateAsset(brief, messaging, type) });
  } catch (err) {
    await slot.refund();
    console.warn("[asset] failed", err);
    return fail({ status: "unavailable", message: "This asset couldn't be regenerated right now — try again later." });
  }
}
