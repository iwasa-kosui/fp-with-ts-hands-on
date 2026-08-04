import { describe, expect, test } from "vitest";
import { agentReviewChecklist, buildFollowUpAgentPrompt } from "../src/clinic/agent-review.js";

describe("04 Agent Review", () => {
  test("次の追加要求を依頼する前に、横断レビュー観点をそろえる", () => {
    expect(agentReviewChecklist.map((item) => item.kind)).toEqual([
      "StateTransition",
      "BoundaryValidation",
      "SensitiveData",
      "ResultError",
      "DomainEvent",
    ]);

    const prompt = buildFollowUpAgentPrompt();
    for (const item of agentReviewChecklist) {
      for (const phrase of item.mustMention) {
        expect(prompt).toContain(phrase);
      }
    }
  });
});
