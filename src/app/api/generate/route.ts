// POST /api/generate — brief in, generated tier/messaging/analysis/assets out.
// Never returns an error screen: failures come back as a typed status the UI turns into a
// graceful "generation unavailable" state (CLAUDE.md fallback chain).
import { NextResponse } from "next/server";
import { generateLaunchContent } from "@/lib/ai/generate";
import { GenerationUnavailable } from "@/lib/ai/models";
import { fail, parseBody, reserve, type Failure } from "@/lib/ai/route-guard";
import { briefSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

export type GenerateResponse = { status: "ok"; content: Awaited<ReturnType<typeof generateLaunchContent>> } | Failure;

export async function POST(req: Request) {
  const body = await parseBody(req, briefSchema, 16_000);
  if (!body.ok) return body.res;
  const slot = await reserve(req);
  if (!slot.ok) return slot.res;
  try {
    const content = await generateLaunchContent(body.data);
    return NextResponse.json<GenerateResponse>({ status: "ok", content });
  } catch (err) {
    await slot.refund();
    if (err instanceof GenerationUnavailable) {
      console.warn("[generate] fallback chain exhausted", err.attempts);
      return fail({ status: "unavailable", message: "Every model in the fallback chain is busy right now. Your plan was built without AI — try again later." });
    }
    console.error("[generate] unexpected error", err);
    return fail({ status: "unavailable", message: "Generation failed unexpectedly. Your plan was built without AI — try again later." });
  }
}
