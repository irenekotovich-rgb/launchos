// POST /api/generate — brief in, generated tier/messaging/analysis/assets out.
// Never returns an error screen: failures come back as a typed status the UI turns into a
// graceful "generation unavailable" state (CLAUDE.md fallback chain).
import { NextResponse } from "next/server";
import { generateLaunchContent } from "@/lib/ai/generate";
import { GenerationUnavailable } from "@/lib/ai/models";
import { briefSchema } from "@/lib/ai/schemas";
import { refundRun, reserveRun } from "@/lib/budget";
import { modelChain } from "@/lib/ai/models";

const MAX_BODY_BYTES = 16_000;

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
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json<GenerateResponse>({ status: "invalid", message: "Request body too large." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json<GenerateResponse>({ status: "invalid", message: "Body must be JSON." }, { status: 400 });
  }
  const parsed = briefSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    return NextResponse.json<GenerateResponse>(
      { status: "invalid", message: `The brief is incomplete or invalid (${fields}).` },
      { status: 400 },
    );
  }

  if (!modelChain().length) {
    return NextResponse.json<GenerateResponse>({
      status: "unavailable",
      message: "No model API keys are configured on this deployment. Your plan was built without AI.",
    });
  }

  // Public demo, no accounts: the client key is the forwarded IP (best effort, documented in decisions-log).
  const client = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const budget = await reserveRun(new Date(), client);
  if (!budget.allowed) {
    const message =
      budget.reason === "client"
        ? "You've reached the live-generation limit for this hour on the demo. Your plan was built without AI; run LaunchOS on your own keys for unlimited generations."
        : budget.reason === "storage"
          ? "Live generation is paused on this demo right now. Your plan was built without AI — try again later."
          : `Today's ${budget.limit} live generations on this demo are used up. Your plan was built without AI; run LaunchOS on your own keys for unlimited generations.`;
    return NextResponse.json<GenerateResponse>({ status: "budget-exhausted", message });
  }

  try {
    const content = await generateLaunchContent(parsed.data);
    return NextResponse.json<GenerateResponse>({ status: "ok", content });
  } catch (err) {
    await refundRun(new Date(), client);
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
