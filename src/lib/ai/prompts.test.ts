import { readdirSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { loadPrompt, render } = await import("./prompts");
const { ASSET_TYPES } = await import("./generate");

const names = readdirSync("prompts").filter((f) => f.endsWith(".md") && f !== "README.md").map((f) => f.replace(/\.md$/, ""));

describe("prompt files", () => {
  it("exist for tier, analysis and every asset type", () => {
    for (const n of ["brief-to-tier", "analysis-draft", ...ASSET_TYPES.map((t) => `asset-${t}`)]) expect(names).toContain(n);
  });
  for (const name of names) {
    it(`${name} has a version and renders with brief + messaging`, async () => {
      const p = await loadPrompt(name);
      expect(p.version).toBeGreaterThan(0);
      const out = render(p.body, { brief: "BRIEF", messaging: "MESSAGING" });
      expect(out).toContain("BRIEF");
      expect(out).not.toMatch(/\{\{\w+\}\}/);
    });
  }
  it("fails loudly on a missing variable", () => {
    expect(() => render("Hi {{name}}", {})).toThrow(/Missing prompt variable: name/);
  });
});
