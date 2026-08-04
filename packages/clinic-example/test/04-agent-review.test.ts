import { describe, expect, test } from "vitest";
import { agentReviewChecklist, buildFollowUpAgentPrompt } from "../src/clinic/agent-review.js";

describe("04 Agent Review", () => {
  test("レビュー checklist が次の追加要求の制約を明示する", () => {
    expect(agentReviewChecklist).toHaveLength(5);
    expect(buildFollowUpAgentPrompt()).toContain("FollowUpRequested");
    expect(buildFollowUpAgentPrompt()).toContain("Sensitive");
    expect(buildFollowUpAgentPrompt()).toContain("Result");
  });
});
