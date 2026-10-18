// Money helpers for expected-results impact: one cleaning path for edits and untrusted docs,
// and formatting that can never throw (Intl throws on invalid currency codes).
import type { ExpectedResults, Impact } from "./types";

/** Three ASCII letters (ISO 4217 shape), upper-cased; anything else falls back. */
export function normalizeCurrency(s: unknown, fallback = "USD"): string {
  const c = typeof s === "string" ? s.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(c) ? c : fallback;
}

const MAX_AMOUNT = 1e12;

export function cleanImpact(i: unknown): Impact | null {
  if (!i || typeof i !== "object") return null;
  const r = i as Record<string, unknown>;
  const amount = typeof r.amount === "number" ? r.amount : NaN;
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) return null;
  return {
    amount,
    currency: normalizeCurrency(r.currency),
    period: typeof r.period === "string" ? r.period.trim().slice(0, 40) : "",
    note: typeof r.note === "string" ? r.note.trim().slice(0, 140) : "",
  };
}

export function cleanExpected(x: unknown): ExpectedResults | undefined {
  if (!x || typeof x !== "object") return undefined;
  const r = x as Record<string, unknown>;
  return {
    userExperience: Array.isArray(r.userExperience)
      ? r.userExperience.filter((l): l is string => typeof l === "string").map((l) => l.trim().slice(0, 160)).filter(Boolean).slice(0, 6)
      : [],
    revenue: cleanImpact(r.revenue),
    expenses: cleanImpact(r.expenses),
  };
}

export function formatMoney(i: Impact): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: normalizeCurrency(i.currency), notation: "compact", maximumFractionDigits: 1 }).format(i.amount);
  } catch {
    return `${i.amount} ${i.currency}`;
  }
}

/** Accepts digits with optional thousands separators and decimals: "250000", "250,000", "1.5". */
export function parseAmount(s: string): number | null {
  const t = s.trim().replace(/,/g, "");
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n <= MAX_AMOUNT ? n : null;
}
