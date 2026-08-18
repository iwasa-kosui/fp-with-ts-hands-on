import { describe, expect, it } from "vitest";
import {
  commonReviewChecksFor,
  reviewDiffStatCommand,
  reviewStatusCommand,
  sessionBySlug,
  sessionNeighbors,
  sessionPath,
  sessions,
  type SessionSummary,
} from "./catalog";

const exerciseSessions = sessions.filter((session) => session.kind === "exercise");
const expectedPeerReviewQuestions = [
  "この差分では、不変条件を型で守っていますか。それとも実行時の `if` で守っていますか。該当する行を1行、画面上で示してください。",
  "この状態を壊すコードを1行書くとしたら、どう書きますか。それはコンパイルを通りますか。",
  "自分の差分と違うところを1つ挙げてください。どちらが良いかは言わなくてよいです。",
] as const;

describe("session catalog invariants", () => {
  it("1. keeps the canonical workflow curriculum in workshop order", () => {
    expect(
      sessions.map((rawSession) => {
        const session: SessionSummary = rawSession;
        return {
          sequence: session.sequence,
          title: session.title,
          path: sessionPath(session),
          durationMinutes: session.durationMinutes,
          kind: session.kind,
          exerciseCommand: session.exerciseCommand,
        };
      }),
    ).toEqual([
      {
        sequence: "00",
        title: "業務とシステムを引き継ぐ",
        path: "/sessions/00-system-handover/",
        durationMinutes: 10,
        kind: "orientation",
        exerciseCommand: undefined,
      },
      {
        sequence: "01",
        title: "ビジネスイベントからワークフローを描く",
        path: "/sessions/01-business-events-and-workflows/",
        durationMinutes: 15,
        kind: "workshop",
        exerciseCommand: undefined,
      },
      {
        sequence: "02",
        title: "予約の状態と遷移をモデル化する",
        path: "/sessions/02-state-transitions/",
        durationMinutes: 30,
        kind: "exercise",
        exerciseCommand: "pnpm exercise:02",
      },
      {
        sequence: "03",
        title: "外部境界と意味のある値を設計する",
        path: "/sessions/03-boundaries-and-semantic-values/",
        durationMinutes: 30,
        kind: "exercise",
        exerciseCommand: "pnpm exercise:03",
      },
      {
        sequence: "04",
        title: "失敗をワークフローの結果として扱う",
        path: "/sessions/04-workflow-errors/",
        durationMinutes: 30,
        kind: "exercise",
        exerciseCommand: "pnpm exercise:04",
      },
      {
        sequence: "05",
        title: "副作用と整合性境界を設計する",
        path: "/sessions/05-effects-and-consistency/",
        durationMinutes: 30,
        kind: "exercise",
        exerciseCommand: "pnpm exercise:05",
      },
      {
        sequence: "Final",
        title: "参照実装で境界をたどる",
        path: "/sessions/final/",
        durationMinutes: 5,
        kind: "reference",
        exerciseCommand: undefined,
      },
    ]);
    expect(new Set(sessions.map(({ slug }) => slug)).size).toBe(sessions.length);
    expect(new Set(sessions.map(({ sequence }) => sequence)).size).toBe(sessions.length);
  });

  it("2. gives S1 no Code Explorer snapshot and exposes only public snapshots", () => {
    expect(
      sessions.map((rawSession) => {
        const session: SessionSummary = rawSession;
        return session.snapshot;
      }),
    ).toEqual([
      "session-00",
      undefined,
      "session-02",
      "session-03",
      "session-04",
      "session-05",
      "final",
    ]);
  });

  it("3. connects every session to the workflow and its risk handoff", () => {
    expect(sessions.map(({ workflowFocus }) => workflowFocus)).toEqual([
      "現状",
      "ドメインイベント",
      "current state",
      "input",
      "expected failures",
      "output event/side effects",
      "境界確認",
    ]);
    for (const session of sessions) {
      expect(session.workflowRisks.resolvedFromPrevious.trim()).not.toBe("");
      expect(session.workflowRisks.remainingForNext.trim()).not.toBe("");
    }
  });

  it("4. makes each time breakdown add up to its duration", () => {
    for (const rawSession of sessions) {
      const session: SessionSummary = rawSession;
      expect(session.timeBreakdown).toBeDefined();
      if (session.timeBreakdown === undefined) continue;
      expect(Object.values(session.timeBreakdown).reduce<number>((sum, value) => sum + value, 0)).toBe(
        session.durationMinutes,
      );
    }
  });

  it("5. makes each ADV breakdown add up to exercise time", () => {
    expect(exerciseSessions).toHaveLength(4);
    for (const session of exerciseSessions) {
      expect(Object.values(session.adv).reduce((sum, value) => sum + value, 0)).toBe(
        session.timeBreakdown.exercise,
      );
    }
  });

  it("6. reserves exactly 150 minutes for catalog sessions", () => {
    expect(sessions.reduce((sum, { durationMinutes }) => sum + durationMinutes, 0)).toBe(150);
  });

  it("7. gives every exercise-only metadata field to exercise sessions only", () => {
    for (const rawSession of sessions) {
      const session: SessionSummary = rawSession;
      const isExercise = session.kind === "exercise";
      expect(session.adv !== undefined).toBe(isExercise);
      expect(session.peerReview !== undefined).toBe(isExercise);
      expect(session.exerciseCommand !== undefined).toBe(isExercise);
      expect(session.exerciseModule !== undefined).toBe(isExercise);
      expect(session.solutionSnapshot !== undefined).toBe(isExercise);
      expect(session.solutionPresentation !== undefined).toBe(isExercise);
      expect(session.peerReviewPromises !== undefined).toBe(isExercise);
    }
  });

  it("8. identifies each exercise solution without relying on its slug", () => {
    expect(
      exerciseSessions.map((session) => ({
        snapshot: session.snapshot,
        solutionSnapshot: session.solutionSnapshot,
        solutionPresentation: session.solutionPresentation,
        peerReviewPromises: session.peerReviewPromises,
      })),
    ).toEqual([
      {
        snapshot: "session-02",
        solutionSnapshot: "session-03",
        solutionPresentation: "excerpt",
        peerReviewPromises: "inline",
      },
      {
        snapshot: "session-03",
        solutionSnapshot: "session-04",
        solutionPresentation: "excerpt",
        peerReviewPromises: "reference",
      },
      {
        snapshot: "session-04",
        solutionSnapshot: "session-05",
        solutionPresentation: "excerpt",
        peerReviewPromises: "reference",
      },
      {
        snapshot: "session-05",
        solutionSnapshot: "session-06",
        solutionPresentation: "completed-file",
        peerReviewPromises: "reference",
      },
    ]);
  });

  it("9. gives every exercise one to four steps and one to three decisions", () => {
    for (const session of exerciseSessions) {
      expect(session.steps.length).toBeGreaterThanOrEqual(1);
      expect(session.steps.length).toBeLessThanOrEqual(4);
      expect(session.decisions.length).toBeGreaterThanOrEqual(1);
      expect(session.decisions.length).toBeLessThanOrEqual(3);
    }
  });

  it("10. keeps exercise-only work fields off non-exercise sessions", () => {
    for (const rawSession of sessions.filter(({ kind }) => kind !== "exercise")) {
      const session: SessionSummary = rawSession;
      expect(session.steps ?? []).toHaveLength(0);
      expect(session.decisions ?? []).toHaveLength(0);
      expect(session.exerciseModule).toBeUndefined();
    }
  });

  it("11. describes incidents and every design decision", () => {
    for (const rawSession of sessions) {
      const session: SessionSummary = rawSession;
      expect(session.incident?.trim()).not.toBe("");
      for (const decision of session.decisions ?? []) {
        expect([decision.invariant, decision.byType, decision.notByType].every(Boolean)).toBe(true);
      }
    }
  });

  it("12. caps every exercise budget at five files and 80 effective lines", () => {
    for (const session of exerciseSessions) {
      expect(session.exerciseModule.fileBudget).toBeLessThanOrEqual(5);
      expect(session.exerciseModule.lineBudget).toBeLessThanOrEqual(80);
    }
  });

  it("13. keeps every step target inside its exercise module", () => {
    for (const session of exerciseSessions) {
      for (const target of session.steps.flatMap(({ targets }) => targets)) {
        expect(target.startsWith(`${session.exerciseModule.dir}/`)).toBe(true);
      }
    }
  });

  it("14. keeps each step solution aligned with the exercise presentation metadata", () => {
    for (const session of exerciseSessions) {
      for (const step of session.steps) {
        const solutions: unknown = Reflect.get(step, "solutions");
        expect(solutions, `${session.slug}: ${step.id}`).toEqual(expect.any(Array));
        if (!Array.isArray(solutions)) continue;
        expect(solutions.length, `${session.slug}: ${step.id}`).toBeGreaterThanOrEqual(1);
        for (const solution of solutions) {
          const presentation = Reflect.get(solution, "presentation") ?? "excerpt";
          expect(presentation, `${session.slug}: ${step.id}`).toBe(
            session.solutionPresentation,
          );
          expect(Reflect.get(solution, "path"), `${session.slug}: ${step.id}`).toMatch(
            new RegExp(`^examples/${session.solutionSnapshot}/`),
          );
        }
      }
    }

    const injectContext = exerciseSessions[3].steps.find(
      ({ id }) => id === "s5-inject-context",
    )!;
    expect(Reflect.get(injectContext, "solutions")).toEqual([
      expect.objectContaining({
        path: "examples/session-06/src/useCase/dependencies.ts",
        symbol: "EventContextDependencies",
      }),
      expect.objectContaining({
        path: "examples/session-06/src/useCase/startExamination.ts",
        symbol: "createEventContext",
      }),
    ]);
  });

  it("15. gives peer review data to exercise sessions only", () => {
    for (const rawSession of sessions) {
      const session: SessionSummary = rawSession;
      expect(session.peerReview !== undefined).toBe(session.kind === "exercise");
    }
  });

  it("16. keeps peer review minutes equal to the review time", () => {
    for (const session of exerciseSessions) {
      expect(session.peerReview.minutes).toBe(session.timeBreakdown.review);
    }
  });

  it("17. uses the same three formal peer review questions in every exercise", () => {
    for (const session of exerciseSessions) {
      expect(session.peerReview.questions).toEqual(expectedPeerReviewQuestions);
      expect(session.peerReview.questions.every((question) => question.trim() !== "")).toBe(true);
    }
  });

  it("18. scopes the four common review checks to each current snapshot", () => {
    for (const session of exerciseSessions) {
      const checks = commonReviewChecksFor(session.snapshot);
      expect(checks).toHaveLength(4);
      expect(checks[1]).toContain(reviewDiffStatCommand(session.snapshot));
      expect(checks[1]).toContain(reviewStatusCommand);
      expect(checks[1]).not.toContain("`git diff --stat`");
    }
  });
});
describe("session catalog navigation", () => {
  it("resolves paths and neighbors from the seven-session catalog", () => {
    const session = sessionBySlug("01-business-events-and-workflows");
    expect(session).toBeDefined();
    expect(session === undefined ? undefined : sessionPath(session)).toBe(
      "/sessions/01-business-events-and-workflows/",
    );
    expect(sessionNeighbors("01-business-events-and-workflows")).toEqual({
      previous: sessions[0],
      next: sessions[2],
    });
    expect(sessionNeighbors("final")).toEqual({ previous: sessions[5] });
  });
});
