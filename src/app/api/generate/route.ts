// POST /api/generate — brief in, generated tier/messaging/analysis/assets out.
// Never returns an error screen: failures come back as a typed status the UI turns into a
// graceful "generation unavailable" state (CLAUDE.md fallback chain).
import { NextResponse } from "next/server";
import { generateLaunchContent } from "@/lib/ai/generate";
import { GenerationUnavailable } from "@/lib/ai/models";
import { briefSchema } from "@/lib/ai/schemas";
import { reserveRun } from "@/lib/budget";

export const runtime = "nodejs";
export const maxDuration = 120;

export type GenerateResponse =
  | { status: "ok"; content: Awaited<ReturnType<typeof generateLaunchContent>> }
  | { status: "invalid"; message: string }
  | { status: "budget-exhausted"; message: string }
  | { status: "unavailable"; message: string };

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<GenerateResponse>({ status: "invalid", message: "Body must be JSON." }, { status: 400 });
  }
  const parsed = briefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<GenerateResponse>({ status: "invalid", message: "The brief is incomplete or too long." }, { status: 400 });
  }

  const budget = await reserveRun();
  if (!budget.allowed) {
    return NextResponse.json<GenerateResponse>({
      status: "budget-exhausted",
      message: `Today's ${budget.limit} live generations on this demo are used up. Your plan was built without AI; run LaunchOS on your own keys for unlimited generations.`,
    });
  }

  try {
    const content = await generateLaunchContent(parsed.data);
    return NextResponse.json<GenerateResponse>({ status: "ok", content });
  } catch (err) {
    if (err instanceof GenerationUnavailable) {
      console.warn("[generate] fallback chain exhausted", err.attempts);
      return NextResponse.json<GenerateResponse>({
        status: "unavailable",
        message: err.attempts.length
          ? "Every model in the fallback chain is busy right now. Your plan was built without AI — try again later."
          : "No model API keys are configured on this deployment. Your plan was built without AI.",
      });
    }
    console.error("[generate] unexpected error", err);
    return NextResponse.json<GenerateResponse>({
      status: "unavailable",
      message: "Generation failed unexpectedly. Your plan was built without AI — try again later.",
    });
  }
}
