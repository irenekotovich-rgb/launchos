// Brief validation shared by the form and its tests. Launch day = 09:00 local on the picked date.

export const LIMITS = { productName: 80, what: 400, who: 300, whyNow: 400, claim: 300, claims: 8 } as const;
export const MAX_YEARS_AHEAD = 3;

export type Fields = { productName: string; what: string; who: string; whyNow: string; targetDate: string; claims: string };
export type Errors = Partial<Record<keyof Fields, string>>;

export const EMPTY_FIELDS: Fields = { productName: "", what: "", who: "", whyNow: "", targetDate: "", claims: "" };

export function splitClaims(raw: string) {
  return raw.split("\n").map((c) => c.trim()).filter(Boolean);
}

/** Launch day is 09:00 local time on the picked date. Validation and the stored brief both use this. */
export function launchMoment(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T09:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function validateBrief(f: Fields, now: Date): Errors {
  const e: Errors = {};
  const text: [keyof Fields, string, number][] = [
    ["productName", "Product name", LIMITS.productName],
    ["what", "What ships", LIMITS.what],
    ["who", "Who it's for", LIMITS.who],
    ["whyNow", "Why now", LIMITS.whyNow],
  ];
  for (const [k, label, max] of text) {
    const v = f[k].trim();
    if (!v) e[k] = `${label} is required.`;
    else if (v.length > max) e[k] = `Keep it under ${max} characters (now ${v.length}).`;
  }
  const at = launchMoment(f.targetDate);
  const latest = new Date(now);
  latest.setFullYear(latest.getFullYear() + MAX_YEARS_AHEAD);
  if (!f.targetDate) e.targetDate = "Pick a launch day.";
  else if (!at) e.targetDate = "Use a valid date.";
  else if (at.getTime() <= now.getTime()) e.targetDate = "Launch day must be in the future.";
  else if (at.getTime() > latest.getTime()) e.targetDate = `Pick a date within ${MAX_YEARS_AHEAD} years.`;
  const claims = splitClaims(f.claims);
  if (!claims.length) e.claims = "Add at least one claim, one per line.";
  else if (claims.length > LIMITS.claims) e.claims = `Up to ${LIMITS.claims} claims (now ${claims.length}).`;
  else if (claims.some((c) => c.length > LIMITS.claim)) e.claims = `Each claim under ${LIMITS.claim} characters.`;
  return e;
}
