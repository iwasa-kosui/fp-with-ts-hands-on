import { describe, expect, it } from "vitest";
import {
  sessionBySlug,
  sessionNeighbors,
  sessionPath,
  sessions,
  type SessionSummary,
} from "./catalog";

const exerciseSessions = sessions.filter((session) => session.kind === "exercise");
const expectedPeerReviewQuestions = [
  "この差分は、不変条件を型で守っていますか、実行時の `if` で守っていますか。守っている行を1行、画面上で指してください。",
  "この状態を壊すコードを1行書くとしたら、どう書きますか。それはコンパイルを通りますか。",
  "自分の差分と違うところを1つ挙げてください。どちらが良いかは言わなくてよいです。",
] as const;

describe("session catalog invariants", () => {
  it("1. keeps unique slugs and sequences in workshop order", () => {
    expect(sessions.map(({ slug }) => slug)).toEqual([
      "00-onboarding",
      "01-state-modeling",
      "02-boundary-and-ids",
      "03-result-errors",
      "04-effects-and-events",
      "final",
    ]);
    expect(new Set(sessions.map(({ slug }) => slug)).size).toBe(sessions.length);
    expect(new Set(sessions.map(({ sequence }) => sequence)).size).toBe(sessions.length);
  });

  it("2. makes each time breakdown add up to its duration", () => {
    for (const rawSession of sessions) {
      const session: SessionSummary = rawSession;
      expect(session.timeBreakdown).toBeDefined();
      if (session.timeBreakdown === undefined) continue;
      expect(Object.values(session.timeBreakdown).reduce<number>((sum, value) => sum + value, 0)).toBe(
        session.durationMinutes,
      );
    }
  });

  it("3. makes each ADV breakdown add up to exercise time", () => {
    expect(exerciseSessions).toHaveLength(4);
    for (const session of exerciseSessions) {
      expect(Object.values(session.adv).reduce((sum, value) => sum + value, 0)).toBe(
        session.timeBreakdown.exercise,
      );
    }
  });

  it("4. reserves exactly 150 minutes for catalog sessions", () => {
    expect(sessions.reduce((sum, { durationMinutes }) => sum + durationMinutes, 0)).toBe(150);
  });

  it("5. gives every exercise-only metadata field to exercise sessions only", () => {
    for (const rawSession of sessions) {
      const session: SessionSummary = rawSession;
      const isExercise = session.kind === "exercise";
      expect(session.adv !== undefined).toBe(isExercise);
      expect(session.peerReview !== undefined).toBe(isExercise);
      expect(session.exerciseCommand !== undefined).toBe(isExercise);
      expect(session.exerciseModule !== undefined).toBe(isExercise);
    }
  });

  it("6. gives every exercise one to four steps and one to three decisions", () => {
    for (const session of exerciseSessions) {
      expect(session.steps.length).toBeGreaterThanOrEqual(1);
      expect(session.steps.length).toBeLessThanOrEqual(4);
      expect(session.decisions.length).toBeGreaterThanOrEqual(1);
      expect(session.decisions.length).toBeLessThanOrEqual(3);
    }
  });

  it("7. keeps exercise-only work fields off orientation and reference sessions", () => {
    for (const rawSession of sessions.filter(({ kind }) => kind !== "exercise")) {
      const session: SessionSummary = rawSession;
      expect(session.steps ?? []).toHaveLength(0);
      expect(session.decisions ?? []).toHaveLength(0);
      expect(session.exerciseModule).toBeUndefined();
    }
  });

  it("8. describes incidents and every design decision", () => {
    for (const rawSession of sessions) {
      const session: SessionSummary = rawSession;
      expect(session.incident?.trim()).not.toBe("");
      for (const decision of session.decisions ?? []) {
        expect([decision.invariant, decision.byType, decision.notByType].every(Boolean)).toBe(true);
      }
    }
  });

  it("9. caps every exercise budget at five files and 80 effective lines", () => {
    for (const session of exerciseSessions) {
      expect(session.exerciseModule.fileBudget).toBeLessThanOrEqual(5);
      expect(session.exerciseModule.lineBudget).toBeLessThanOrEqual(80);
    }
  });

  it("10. keeps every step target inside its exercise module", () => {
    for (const session of exerciseSessions) {
      for (const target of session.steps.flatMap(({ targets }) => targets)) {
        expect(target.startsWith(`${session.exerciseModule.dir}/`)).toBe(true);
      }
    }
  });

  it("11. gives every step one or more truthful solution snippets", () => {
    for (const session of exerciseSessions) {
      for (const step of session.steps) {
        const solutions: unknown = Reflect.get(step, "solutions");
        expect(solutions, `${session.slug}: ${step.id}`).toEqual(expect.any(Array));
        if (!Array.isArray(solutions)) continue;
        expect(solutions.length, `${session.slug}: ${step.id}`).toBeGreaterThanOrEqual(1);
      }
    }

    const injectContext = sessions[4].steps.find(({ id }) => id === "s4-inject-context")!;
    expect(Reflect.get(injectContext, "solutions")).toEqual([
      expect.objectContaining({
        path: "examples/session-05/src/useCase/dependencies.ts",
      }),
      expect.objectContaining({
        path: "examples/session-05/src/useCase/startExamination.ts",
      }),
    ]);
  });

  it("14. gives peer review data to exercise sessions only", () => {
    for (const rawSession of sessions) {
      const session: SessionSummary = rawSession;
      expect(session.peerReview !== undefined).toBe(session.kind === "exercise");
    }
  });

  it("15. keeps peer review minutes equal to the review time", () => {
    for (const session of exerciseSessions) {
      expect(session.peerReview.minutes).toBe(session.timeBreakdown.review);
    }
  });

  it("16. uses the same three formal peer review questions in every exercise", () => {
    for (const session of exerciseSessions) {
      expect(session.peerReview.questions).toEqual(expectedPeerReviewQuestions);
      expect(session.peerReview.questions.every((question) => question.trim() !== "")).toBe(true);
    }
  });
});
describe("session catalog navigation", () => {
  it("resolves paths and neighbors from the six-session catalog", () => {
    const session = sessionBySlug("01-state-modeling");
    expect(session).toBeDefined();
    expect(session === undefined ? undefined : sessionPath(session)).toBe(
      "/sessions/01-state-modeling/",
    );
    expect(sessionNeighbors("01-state-modeling")).toEqual({
      previous: sessions[0],
      next: sessions[2],
    });
    expect(sessionNeighbors("final")).toEqual({ previous: sessions[4] });
  });
});
