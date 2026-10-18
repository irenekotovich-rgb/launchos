// Drift control for the palette: token changes can't silently break WCAG contrast.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const token = (name: string) => {
  const m = root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} missing or not a hex colour`);
  return m[1];
};

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("palette contrast (CLAUDE.md: body ≥ 4.5:1)", () => {
  for (const surface of ["background", "card"]) {
    for (const fg of ["foreground", "muted-foreground", "destructive", "primary", "brand-orange", "success", "warning"]) {
      it(`${fg} on ${surface} ≥ 4.5`, () => {
        expect(ratio(token(fg), token(surface))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  it("primary-foreground on primary ≥ 4.5", () => {
    expect(ratio(token("primary-foreground"), token("primary"))).toBeGreaterThanOrEqual(4.5);
  });
});
