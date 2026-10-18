import { describe, expect, it } from "vitest";
import { cleanExpected, cleanImpact, formatMoney, normalizeCurrency, parseAmount } from "./money";

describe("money (review PR #14)", () => {
  it("normalises currency codes and falls back on anything else", () => {
    expect(normalizeCurrency(" eur ")).toBe("EUR");
    for (const bad of ["€", "A1", "US", "@@@", 5, null]) expect(normalizeCurrency(bad)).toBe("USD");
  });
  it("never throws when formatting", () => {
    expect(formatMoney({ amount: 288000, currency: "USD", period: "", note: "" })).toBe("$288K");
    expect(() => formatMoney({ amount: 1, currency: "€", period: "", note: "" })).not.toThrow();
  });
  it("cleans impacts: negative, infinite or huge amounts are dropped; strings capped", () => {
    expect(cleanImpact({ amount: -5, currency: "USD" })).toBeNull();
    expect(cleanImpact({ amount: Infinity, currency: "USD" })).toBeNull();
    expect(cleanImpact({ amount: 2e12, currency: "USD" })).toBeNull();
    expect(cleanImpact({ amount: 10, currency: "usd", period: "x".repeat(99), note: 7 })).toEqual({ amount: 10, currency: "USD", period: "x".repeat(40), note: "" });
  });
  it("one cleaning path for edits and untrusted docs", () => {
    expect(cleanExpected({ userExperience: [" a ", "", 3, "b"], revenue: { amount: 1, currency: "usd" }, expenses: "junk" })).toEqual({
      userExperience: ["a", "b"],
      revenue: { amount: 1, currency: "USD", period: "", note: "" },
      expenses: null,
    });
    expect(cleanExpected("nope")).toBeUndefined();
  });
  it("parses amounts with separators, rejects junk and overflow", () => {
    expect(parseAmount("250,000")).toBe(250000);
    expect(parseAmount("1.5")).toBe(1.5);
    for (const bad of [".5", "1e6", "abc", "9".repeat(400)]) expect(parseAmount(bad)).toBeNull();
  });
});
