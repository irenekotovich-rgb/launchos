import { describe, expect, it } from "vitest";
import { countryFrom } from "./geo";

describe("countryFrom (/api/geo)", () => {
  it("returns only a two-letter country code", () => {
    expect(countryFrom(new Headers({ "x-vercel-ip-country": "de" }))).toBe("DE");
    expect(countryFrom(new Headers({ "x-vercel-ip-country": "DE, 1.2.3.4" }))).toBeNull();
    expect(countryFrom(new Headers({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
    expect(countryFrom(new Headers())).toBeNull();
    expect(countryFrom(new Headers({ "x-vercel-ip-country": "XX" }))).toBeNull();
  });
});
