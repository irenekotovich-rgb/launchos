import { describe, expect, it } from "vitest";
import { DEMO_AUTHORED_AT, getDemoLaunch } from "./demo";
import { prepareImport, setShareInfo } from "./edit";
import { emailsInSnapshot, exportFileName, randomToken, redactForShare, SHARE_ID, toExportFile } from "./share";

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

describe("review PR #11", () => {
  it("the export never contains the share delete token", () => {
    const doc = setShareInfo(own(), { id: "x".repeat(32), deleteToken: "DELETE-TOKEN-SENTINEL", createdAt: NOW.toISOString() }, NOW);
    expect(JSON.stringify(toExportFile(doc, NOW))).not.toContain("DELETE-TOKEN-SENTINEL");
  });

  it("sentinel test: personal fields are removed, free text is kept (and its emails reported)", () => {
    const doc = own();
    doc.meta.generation = { status: "live", note: "SENTINEL-GEN" };
    doc.alignment.metrics = doc.alignment.metrics.map((m) => ({ ...m, owner: "SENTINEL-OWNER" }));
    doc.checklist = doc.checklist.map((c) => ({ ...c, owner: "SENTINEL-OWNER", note: "SENTINEL-NOTE" }));
    doc.decisions.push({ id: "dx", date: NOW.toISOString(), text: "Ping SENTINEL-FREE pat@acme.test", author: "PMM" });
    const out = JSON.stringify(redactForShare(doc));
    for (const gone of ["SENTINEL-GEN", "SENTINEL-OWNER", "SENTINEL-NOTE", "priya.nair@example.com", "Hannah Brooks", doc.meta.id]) {
      expect(out).not.toContain(gone);
    }
    expect(out).toContain("SENTINEL-FREE"); // free text is published as written…
    expect(emailsInSnapshot(doc)).toEqual(["pat@acme.test"]); // …and the confirm step flags its emails
  });

  it("a demo export imported stays labelled demo", () => {
    const demoFile = JSON.parse(JSON.stringify(toExportFile(getDemoLaunch(NOW), NOW)));
    expect(prepareImport(demoFile, "id", NOW)?.meta.mode).toBe("demo");
  });

  it("import rejects docs missing a team or with malformed stages", () => {
    const file = JSON.parse(JSON.stringify(toExportFile(own(), NOW)));
    delete file.alignment.signoffs.legal;
    expect(prepareImport(file, "id", NOW)).toBeNull();
    const file2 = JSON.parse(JSON.stringify(toExportFile(own(), NOW)));
    file2.rollout.stages[2].readings = "nope";
    expect(prepareImport(file2, "id", NOW)).toBeNull();
  });
});

describe("sanitizeLaunchDoc (review PR #13)", async () => {
  const { sanitizeLaunchDoc } = await import("./validate");
  it("drops malformed facts and points instead of crashing the room", () => {
    const doc = own();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc.analysis.fields.context as any).highlights = [{ value: 5 }, "x", { value: "1", label: "ok", level: 500, visual: "boom" }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (doc.analysis.fields.context as any).points = ["fine", 3, null];
    const clean = sanitizeLaunchDoc(doc).analysis.fields.context;
    expect(clean.highlights).toEqual([{ value: "1", label: "ok", visual: "stat", level: 100 }]);
    expect(clean.points).toEqual(["fine"]);
  });
});
