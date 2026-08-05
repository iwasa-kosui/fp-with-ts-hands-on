import { describe, expect, it } from "vitest";
import { assertModuleMeetsPrd } from "../module-content";
import { resultErrorsModule } from "./03-result-errors";
import { agentReviewModule } from "./04-agent-review";

describe("Result errors and agent review modules", () => {
  it("starts Result errors from a new requirement and limits the edit to the use case", () => {
    expect(resultErrorsModule.trigger.kind).toBe("new-requirement");
    expect(resultErrorsModule.editTargets.map(({ symbol }) => symbol)).toEqual([
      "startExaminationUseCase",
    ]);
    expect(resultErrorsModule.technique.limits).toContain("event sourcing");
    expect(() => assertModuleMeetsPrd(resultErrorsModule)).not.toThrow();
  });

  it("starts agent review from review and separates automated checks from requirement review", () => {
    expect(agentReviewModule.trigger.kind).toBe("review");
    expect(agentReviewModule.editTargets.map(({ symbol }) => symbol)).toEqual([
      "agentReviewChecklist",
      "buildFollowUpAgentPrompt",
    ]);
    expect(agentReviewModule.technique.limits).toContain("型が通ることだけで要求適合性まで保証できるとは扱いません");
    expect(agentReviewModule.reviewPoints).toContain("型とテストで確認できる不正な組み合わせを確認する。");
    expect(agentReviewModule.reviewPoints).toContain("人が要求から、終端状態、境界、PII、失敗型、変更記録を確認する。");
    expect(() => assertModuleMeetsPrd(agentReviewModule)).not.toThrow();
  });
});
