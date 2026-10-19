// Country from Vercel's edge header as an ISO 3166-1 alpha-2 code — the only location data kept.
export function countryFrom(headers: Headers): string | null {
  const c = headers.get("x-vercel-ip-country")?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(c) ? c : null;
}
