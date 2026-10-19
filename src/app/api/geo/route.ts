// GET /api/geo — the visitor's country as an ISO 3166-1 alpha-2 code, nothing else.
// Lets analytics carry a country while PostHog discards client IPs (docs/metrics.md).
// Vercel sets x-vercel-ip-country at the edge; elsewhere the answer is null.
import { NextResponse } from "next/server";
import { countryFrom } from "@/lib/geo";

export const dynamic = "force-dynamic";


export function GET(req: Request) {
  return NextResponse.json({ country: countryFrom(req.headers) }, { headers: { "Cache-Control": "private, no-store" } });
}
