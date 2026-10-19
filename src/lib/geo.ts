// Country from Vercel's edge header as an ISO 3166-1 alpha-2 code — the only location data kept.
export function countryFrom(headers: Headers): string | null {
  const c = headers.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  // XX / T1 are "unknown" / Tor markers some providers use — not real countries.
  return /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
}
