import { describe, expect, it } from "vitest";
import { sessions, type ExerciseStep } from "./catalog";
import { loadSolutionSnippets } from "./solution-snippets";

const step = sessions
  .find(({ slug }) => slug === "02-state-transitions")
  ?.steps.at(0);

if (step === undefined) {
  throw new Error("S2 の解答ステップが見つかりません");
}

describe("loadSolutionSnippets", () => {
  it("reads non-empty code from the requested source lines", async () => {
    const snippets = await loadSolutionSnippets(step);

    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.code.trim()).not.toBe("");
    expect(snippets[0]?.code).toContain("startExamination");
  });

  it("rejects source lines outside the file", async () => {
    const invalidStep: ExerciseStep = {
      ...step,
      solutions: [
        {
          ...step.solutions[0],
          lines: [1, Number.MAX_SAFE_INTEGER],
        },
      ],
    };

    await expect(loadSolutionSnippets(invalidStep)).rejects.toThrow(
      "指定行がソースの範囲外です",
    );
  });
});
