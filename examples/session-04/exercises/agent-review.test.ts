import { expect, it } from "vitest";

it("横断レビューが dual-write と PII inspect を検出する", async () => {
  const { agentReviewChecklist, buildFollowUpAgentPrompt } =
    await import("../src/review/agent-review.js");

  expect(agentReviewChecklist.map(({ kind }) => kind)).toEqual([
    "StateTransition",
    "BoundaryValidation",
    "SensitiveData",
    "ResultError",
    "DomainEvent",
  ]);
  const prompt = buildFollowUpAgentPrompt();
  expect(prompt).toContain("save(state, events)");
  expect(prompt).toContain("nodejs.util.inspect.custom");
});
