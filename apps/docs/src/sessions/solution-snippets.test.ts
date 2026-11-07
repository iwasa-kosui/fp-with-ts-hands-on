import { describe, expect, it } from "vitest";
import { session } from "../pages/sessions/01-state-transitions.astro";
import { supplementaryExercise } from "../pages/sessions/03-boundaries-and-pii.astro";
import { session as session04 } from "../pages/sessions/04-workflow-errors.astro";
import type { ExerciseStep } from "./types";
import { loadSolutionSnippets } from "./solution-snippets";

const step = session.steps.at(0);

if (step === undefined) {
  throw new Error("S1 の解答ステップが見つかりません");
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

  it("keeps Session 04 solution excerpts self-contained", async () => {
    const snippets = await Promise.all(
      session04.steps.map((sessionStep) => loadSolutionSnippets(sessionStep)),
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
    expect(webHandler?.[1]?.code).toContain("result.match");
    expect(webHandler?.[1]?.code).toContain("toStartExaminationNoticeCode(error)");
    expect(webHandler?.[1]?.code).not.toContain("try {");
  });

  it("declares where each Session 04 solution is applied", () => {
    for (const sessionStep of session04.steps) {
      for (const solution of sessionStep.solutions) {
        expect(solution.placement).toBeDefined();
        expect(solution.placement?.startsWith("examples/session-05/")).toBe(true);
      }
    }
  });

  it("loads supplementary exercise identifier solutions from their owning concept", async () => {
    const [identifierStep] = supplementaryExercise.steps;
    expect(identifierStep?.solutions.map(({ path }) => path)).toEqual([
      "examples/session-04/src/domain/appointment/appointmentId.ts",
      "examples/session-04/src/domain/appointment/veterinarianId.ts",
    ]);

    const snippets = await loadSolutionSnippets(identifierStep!);
    expect(snippets.map(({ code }) => code)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("AppointmentId"),
        expect.stringContaining("VeterinarianId"),
      ]),
    );
  });
});
