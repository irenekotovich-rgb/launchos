import { describe, expect, it } from "vitest";
import { DEMO_AUTHORED_AT, getDemoLaunch } from "./demo";
import { prepareImport, setShareInfo } from "./edit";
import { exportFileName, randomToken, redactForShare, SHARE_ID, toExportFile } from "./share";

const NOW = new Date(DEMO_AUTHORED_AT);
const own = () => ({ ...getDemoLaunch(NOW), meta: { ...getDemoLaunch(NOW).meta, mode: "own" as const } });

describe("export, import, share", () => {
  it("export carries the author and round-trips through import as a fresh own launch", () => {
    const doc = setShareInfo(own(), { id: "x".repeat(32), deleteToken: "secret", createdAt: NOW.toISOString() }, NOW);
    const file = JSON.parse(JSON.stringify(toExportFile(doc, NOW)));
    expect(file.author).toEqual({ name: "Iryna Kotovych", url: "https://www.linkedin.com/in/irynakotovych/" });
    const imported = prepareImport(file, "new-id", NOW)!;
    expect(imported.meta).toMatchObject({ id: "new-id", mode: "own" });
    expect(imported.meta.share).toBeUndefined();
    expect("author" in imported).toBe(false);
    expect(imported.decisions.at(-1)?.text).toBe("Launch imported from a JSON file.");
  });
  it("import rejects anything that isn't a LaunchDoc", () => {
    expect(prepareImport({ hello: "world" }, "id", NOW)).toBeNull();
    expect(prepareImport(null, "id", NOW)).toBeNull();
  });
  it("share snapshots strip recipients, sign-off names/notes and share secrets", () => {
    const doc = setShareInfo(own(), { id: "x".repeat(32), deleteToken: "secret", createdAt: NOW.toISOString() }, NOW);
    const shared = redactForShare(doc);
    expect(shared.rollout.recipients).toEqual([]);
    expect(Object.values(shared.alignment.signoffs).every((s) => s.lead === "" && s.note === "")).toBe(true);
    expect(Object.values(shared.alignment.signoffs).map((s) => s.status)).toContain("signed");
    expect(JSON.stringify(shared)).not.toContain("secret");
    expect(JSON.stringify(shared)).not.toContain("@example.com");
  });
  it("share ids are 32-char base64url and unique", () => {
    const a = randomToken(24);
    expect(a).toMatch(SHARE_ID);
    expect(randomToken(24)).not.toBe(a);
  });
  it("file names are slugged", () => {
    expect(exportFileName(own())).toBe("launchos-launch-service.json");
  });
});
