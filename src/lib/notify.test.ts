import { describe, expect, it } from "vitest";
import { DEMO_AUTHORED_AT, getDemoLaunch } from "./demo";
import { composeStageMessage, mailtoUrl } from "./notify";

const NOW = new Date(DEMO_AUTHORED_AT);

describe("stage-complete message", () => {
  const doc = getDemoLaunch(NOW);
  it("goes to stakeholders and every team lead", () => {
    const m = composeStageMessage(doc, doc.rollout.stages[0], NOW);
    expect(m.to).toHaveLength(7);
    expect(m.to).toContain("priya.nair@example.com");
  });
  it("names the stage, the increment, the gate and the next stage", () => {
    const m = composeStageMessage(doc, doc.rollout.stages[1], NOW);
    expect(m.subject).toBe("Launch Service: 30% rollout stage complete");
    expect(m.body).toContain("(+20% this stage)");
    expect(m.body).toContain("Gate passed");
    expect(m.body).toContain("near threshold");
    expect(m.body).toMatch(/Next: 60% planned for/);
  });
  it("flags the 100% stage as fully rolled out", () => {
    const m = composeStageMessage(doc, doc.rollout.stages[3], NOW);
    expect(m.subject).toBe("Launch Service: rolled out to 100%");
    expect(m.body).toContain("rolled out to 100% of the audience");
  });
  it("encodes a mailto link", () => {
    const url = mailtoUrl({ to: ["a@example.com", "b@example.com"], subject: "S & T", body: "a\nb" });
    expect(url).toBe("mailto:a%40example.com,b%40example.com?subject=S%20%26%20T&body=a%0Ab");
  });
});

describe("closed stages are judged when they closed", () => {
  it("10% stage message says the gate passed even days later", () => {
    const later = new Date(DEMO_AUTHORED_AT + 10 * 86_400_000);
    const doc = getDemoLaunch(NOW);
    expect(composeStageMessage(doc, doc.rollout.stages[0], later).body).toContain("Gate passed");
  });
});
