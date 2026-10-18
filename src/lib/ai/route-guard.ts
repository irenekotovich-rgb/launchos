// Shared guards for the model-calling API routes: body size, schema, keys, throttle + daily budget.
// Every outcome is typed JSON so the UI can show a graceful state — never an error screen.
import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { modelChain } from "./models";
import { refundRun, reserveRun } from "../budget";

/** Prefer the platform-set client IP; x-forwarded-for's first value is client-supplied. */
function clientKey(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

export const MAX_BODY_BYTES = 110_000; // eight assets × 9,000 chars + brief and messaging, with headroom for UTF-8 and JSON escaping
const bytes = (s: string) => new TextEncoder().encode(s).length;

export type Failure =
  | { status: "invalid"; message: string }
  | { status: "budget-exhausted"; message: string }
  | { status: "unavailable"; message: string };

export function fail(body: Failure, httpStatus = 200) {
  return NextResponse.json(body, { status: httpStatus });
}

export async function parseBody<T>(req: Request, schema: z.ZodType<T>, maxBytes = MAX_BODY_BYTES): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  let body: unknown;
  try {
    const raw = await req.text();
    if (bytes(raw) > maxBytes) return { ok: false, res: fail({ status: "invalid", message: "Request body too large." }, 413) };
    body = JSON.parse(raw);
  } catch {
    return { ok: false, res: fail({ status: "invalid", message: "Body must be JSON." }, 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    return { ok: false, res: fail({ status: "invalid", message: `The request is incomplete or invalid (${fields}).` }, 400) };
  }
  return { ok: true, data: parsed.data };
}

/** Checks keys, then reserves `cost` budget runs for this client. Returns a refund fn. */
export async function reserve(
  req: Request,
  cost: number,
  suffix = "",
): Promise<{ ok: true; refund: () => Promise<void> } | { ok: false; res: NextResponse }> {
  if (!modelChain().length) {
    return { ok: false, res: fail({ status: "unavailable", message: `No model API keys are configured on this deployment.${suffix}` }) };
  }
  // Public demo, no accounts: the client key is the IP (best effort, see decisions-log).
  const client = clientKey(req);
  const budget = await reserveRun(new Date(), client, cost);
  if (!budget.allowed) {
    const message =
      budget.reason === "client"
        ? "You've reached the live-generation limit for this hour on the demo. Run LaunchOS on your own keys for unlimited generations."
        : budget.reason === "storage"
          ? "Live generation is paused on this demo right now — try again later."
          : `Today's ${budget.limit} live generations on this demo are used up. Run LaunchOS on your own keys for unlimited generations.`;
    return { ok: false, res: fail({ status: "budget-exhausted", message: message + suffix }) };
  }
  return { ok: true, refund: () => refundRun(new Date(), client, cost) };
}
