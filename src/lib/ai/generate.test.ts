import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { briefAsText, normalizeText } = await import("./generate");

describe("generation helpers", () => {
  it("turns double-escaped newlines into real ones", () => {
    expect(normalizeText("Q: Who?\\nA: PMs.  \\nQ: When?")).toBe("Q: Who?\nA: PMs.\nQ: When?");
    expect(normalizeText("Line one\nLine two")).toBe("Line one\nLine two");
  });
  it("renders the brief as plain text with every claim", () => {
    const text = briefAsText({
      productName: "X", what: "w", who: "u", whyNow: "n", targetDate: "2026-12-10T09:00:00.000Z", claims: ["a", "b"],
    });
    expect(text).toContain("Launch day (100% rollout): 2026-12-10");
    expect(text).toContain("- a\n- b");
  });
});
