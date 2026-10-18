import { describe, expect, it } from "vitest";
import { EMPTY_FIELDS, LIMITS, launchMoment, validateBrief, type Fields } from "./brief";

const NOW = new Date(2026, 9, 18, 12, 0, 0); // local time
const valid: Fields = {
  productName: "Approval Workflows", what: "w", who: "u", whyNow: "n",
  targetDate: "2026-11-20", claims: "One\nTwo",
};

describe("validateBrief", () => {
  it("accepts a complete brief", () => {
    expect(validateBrief(valid, NOW)).toEqual({});
  });
  it("requires every field", () => {
    expect(Object.keys(validateBrief(EMPTY_FIELDS, NOW)).sort()).toEqual(
      ["claims", "productName", "targetDate", "what", "who", "whyNow"],
    );
  });
  it("checks length after trimming", () => {
    const exact = "x".repeat(LIMITS.productName);
    expect(validateBrief({ ...valid, productName: `  ${exact}  ` }, NOW).productName).toBeUndefined();
    expect(validateBrief({ ...valid, productName: exact + "x" }, NOW).productName).toMatch(/under 80/);
  });
  it("allows 8 claims, rejects 9, ignores blank lines", () => {
    const lines = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`).join("\n\n");
    expect(validateBrief({ ...valid, claims: lines(8) }, NOW).claims).toBeUndefined();
    expect(validateBrief({ ...valid, claims: lines(9) }, NOW).claims).toMatch(/Up to 8/);
    expect(validateBrief({ ...valid, claims: "x".repeat(301) }, NOW).claims).toMatch(/under 300/);
  });
  it("uses the same 09:00-local moment for the check and the stored date", () => {
    expect(validateBrief({ ...valid, targetDate: "2026-10-18" }, NOW).targetDate).toMatch(/future/); // 09:00 today has passed
    expect(validateBrief({ ...valid, targetDate: "2026-10-19" }, NOW).targetDate).toBeUndefined();
    expect(launchMoment("2026-10-19")!.getHours()).toBe(9);
  });
  it("rejects malformed and far-future dates", () => {
    expect(validateBrief({ ...valid, targetDate: "202610-19" }, NOW).targetDate).toMatch(/valid/);
    expect(validateBrief({ ...valid, targetDate: "2031-01-01" }, NOW).targetDate).toMatch(/within 3 years/);
  });
});
