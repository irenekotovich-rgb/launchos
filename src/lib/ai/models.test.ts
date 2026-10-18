import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
const { recoverJson } = await import("./models");

const schema = z.object({ findings: z.array(z.object({ assetId: z.string() })) });

describe("recoverJson", () => {
  it("extracts fenced or prose-wrapped JSON and validates it", () => {
    expect(recoverJson('Sure! ```json\n{"findings":[{"assetId":"a1"}]}\n``` Hope this helps.', schema)).toEqual({ findings: [{ assetId: "a1" }] });
    expect(recoverJson('{"findings": []}', schema)).toEqual({ findings: [] });
  });
  it("returns null for invalid shapes or no JSON", () => {
    expect(recoverJson('{"wrong": true}', schema)).toBeNull();
    expect(recoverJson("no json here", schema)).toBeNull();
    expect(recoverJson(undefined, schema)).toBeNull();
  });
});
