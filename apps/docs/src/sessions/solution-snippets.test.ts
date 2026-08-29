import { describe, expect, it } from "vitest";
import { session } from "../pages/sessions/02-state-transitions.astro";
import { session as session05 } from "../pages/sessions/05-workflow-errors.astro";
import type { ExerciseStep } from "./types";
import { loadSolutionSnippets } from "./solution-snippets";

const step = session.steps.at(0);

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

  it("keeps Session 05 solution excerpts self-contained", async () => {
    const snippets = await Promise.all(
      session05.steps.map((sessionStep) => loadSolutionSnippets(sessionStep)),
    );
    const [invalidState, notFound, pipeline, webHandler] = snippets;

    expect(invalidState?.[0]?.code).toContain("type StartExaminationError");
    expect(invalidState?.[0]?.code).toContain("type Result");
    expect(notFound?.[0]?.code).toContain("type AppointmentNotFound");
    expect(pipeline?.[0]?.code).toContain("import type { Result }");
    expect(pipeline?.[0]?.code).toContain("type StartExaminationError");
    expect(webHandler?.[0]?.code).toContain("import type { StartExaminationError }");
    expect(webHandler?.[0]?.code).toContain("return assertNever(error)");
    expect(webHandler?.[0]?.code).not.toContain("AppointmentConflict");
    expect(webHandler?.[0]?.code).not.toContain("StartExaminationWithEffectsNoticeCode");
    expect(webHandler?.[0]?.code).not.toContain('"conflict"');
  });
});
