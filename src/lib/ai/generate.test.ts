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

describe("brief schema accepts what the form produces", async () => {
  const { briefSchema } = await import("./schemas");
  const { launchMoment } = await import("../brief");
  it("form brief (09:00 local → ISO with Z) passes; past dates and bare dates fail", () => {
    const future = new Date(Date.now() + 30 * 86_400_000);
    const date = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    const brief = { productName: "X", what: "w", who: "u", whyNow: "n", targetDate: launchMoment(date)!.toISOString(), claims: ["c"] };
    expect(briefSchema.safeParse(brief).success).toBe(true);
    expect(briefSchema.safeParse({ ...brief, targetDate: "2020-01-01T09:00:00.000Z" }).success).toBe(false);
    expect(briefSchema.safeParse({ ...brief, targetDate: date }).success).toBe(false);
  });
});

describe("groundHighlight (review PR #13)", async () => {
  const { groundHighlight } = await import("./generate");
  const brief = "<brief>\nWhat ships: approvals for 2,400 workspaces; usage is growing.\n</brief>";
  it("keeps numbers that appear in the brief (commas ignored)", () => {
    expect(groundHighlight({ value: "2,400", label: "workspaces" }, brief).value).toBe("2,400");
  });
  it("turns an ungrounded number into Needs input", () => {
    expect(groundHighlight({ value: "70%", label: "faster", visual: "meter", level: 70 }, brief)).toEqual({ value: "Needs input", label: "faster", visual: "stat" });
  });
  it("downgrades a trend when the brief states no direction", () => {
    expect(groundHighlight({ value: "Q1", label: "renewals", visual: "trend", trend: "up" }, "<brief>Q1 renewals</brief>").visual).toBe("stat");
    expect(groundHighlight({ value: "Usage", label: "usage", visual: "trend", trend: "up" }, brief).visual).toBe("trend");
  });
});
