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
      const out = render(p.body, { brief: "BRIEF", messaging: "MESSAGING", assets: "ASSETS", metrics: "METRICS" });
      expect(out).toContain("BRIEF");
      expect(out).not.toMatch(/\{\{\w+\}\}/);
    });
  }
  it("fails loudly on a missing variable", () => {
    expect(() => render("Hi {{name}}", {})).toThrow(/Missing prompt variable: name/);
  });
});

describe("asset kit has one source of truth (review PR #15)", async () => {
  const { ASSET_TYPES } = await import("../types");
  const { ASSET_LABEL } = await import("../asset-labels");
  it("every asset type has a label and a versioned prompt file", async () => {
    expect(Object.keys(ASSET_LABEL).sort()).toEqual([...ASSET_TYPES].sort());
    for (const t of ASSET_TYPES) expect((await loadPrompt(`asset-${t}`)).version).toBeGreaterThan(0);
  });
  it("the campaign plan prompt receives the agreed metrics", async () => {
    expect((await loadPrompt("asset-campaign-plan")).body).toContain("{{metrics}}");
  });
});
