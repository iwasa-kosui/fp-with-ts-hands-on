import { describe, expect, it } from "vitest";

import { agentReviewChecklist, buildFollowUpAgentPrompt } from "../src/review/agent-review.js";

describe("Session 05 agent review artifact", () => {
  it("review checklist に横断観点と必須語句を持たせる", () => {
    expect(agentReviewChecklist.map(({ kind }) => kind)).toEqual([
      "StateTransition",
      "BoundaryValidation",
      "SensitiveData",
      "ResultError",
      "DomainEvent",
    ]);
    expect(agentReviewChecklist.every(({ mustMention }) => mustMention.length > 0)).toBe(true);
  });

  it("電話フォローの依頼文にレビューで確認する制約を書く", () => {
    const prompt = buildFollowUpAgentPrompt();

    expect(prompt).toContain("save(state, events)");
    expect(prompt).toContain("nodejs.util.inspect.custom");
    expect(prompt).toContain("unknown");
    expect(prompt).toContain("Result");
    expect(prompt).toContain("atomic");
  });
});
