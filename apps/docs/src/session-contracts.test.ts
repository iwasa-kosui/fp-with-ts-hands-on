import { describe, expect, it } from "vitest";
import type { SessionNavigation, SessionSummary } from "./sessions/types";
type PageModule = Readonly<{
  session: SessionSummary;
  navigation?: SessionNavigation;
}>;

const pageModules = import.meta.glob<PageModule>("./pages/sessions/*.astro", {
  eager: true,
});
const pages = Object.entries(pageModules)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, page]) => ({ path, ...page }));
const sessions = pages.map(({ session }) => session);
const exerciseSessions = sessions.filter(
  (session) => session.kind === "exercise",
);

const expectedCurriculum = [
  {
    slug: "00-system-handover",
    sequence: "00",
    title: "業務とシステムを引き継ぐ",
    durationMinutes: 10,
    kind: "orientation",
    exerciseCommand: undefined,
    snapshot: "session-00",
    timeBreakdown: { brief: 4, teach: 3, exercise: 0, review: 3 },
  },
  {
    slug: "01-business-events-and-workflows",
    sequence: "01",
    title: "ビジネスイベントからワークフローを描く",
    durationMinutes: 15,
    kind: "workshop",
    exerciseCommand: undefined,
    snapshot: undefined,
    timeBreakdown: { brief: 3, teach: 4, exercise: 6, review: 2 },
  },
  {
    slug: "02-state-transitions",
    sequence: "02",
    title: "予約の状態と遷移をモデル化する",
    durationMinutes: 30,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:02",
    snapshot: "session-02",
    timeBreakdown: { brief: 4, teach: 6, exercise: 13, review: 7 },
  },
  {
    slug: "03-semantic-identifiers",
    sequence: "03",
    title: "用途の異なる識別子を型で区別する",
    durationMinutes: 30,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:03",
    snapshot: "session-03",
    timeBreakdown: { brief: 4, teach: 6, exercise: 13, review: 7 },
  },
  {
    slug: "04-boundaries-and-pii",
    sequence: "04",
    title: "外部入力を境界で検証し個人情報を守る",
    durationMinutes: 30,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:04",
    snapshot: "session-04",
    timeBreakdown: { brief: 4, teach: 7, exercise: 12, review: 7 },
  },
  {
    slug: "05-workflow-errors",
    sequence: "05",
    title: "失敗をワークフローの結果として扱う",
    durationMinutes: 30,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:05",
    snapshot: "session-05",
    timeBreakdown: { brief: 4, teach: 3, exercise: 15, review: 8 },
  },
  {
    slug: "06-effects-and-consistency",
    sequence: "06",
    title: "副作用と整合性境界を設計する",
    durationMinutes: 30,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:06",
    snapshot: "session-06",
    timeBreakdown: { brief: 4, teach: 3, exercise: 15, review: 8 },
  },
  {
    slug: "final",
    sequence: "Final",
    title: "参照実装で境界をたどる",
    durationMinutes: 5,
    kind: "reference",
    exerciseCommand: undefined,
    snapshot: "final",
    timeBreakdown: { brief: 0, teach: 4, exercise: 0, review: 1 },
  },
] as const;

const expectedExercises = [
  {
    slug: "02-state-transitions",
    adv: { articulate: 2, delegate: 9, verify: 2 },
    exerciseModule: {
      dir: "examples/session-02/src/domain/appointment",
      fileBudget: 2,
      lineBudget: 35,
    },
    solutionSnapshot: "session-03",
    solutionPresentation: "excerpt",
    peerReviewPromises: "inline",
    peerReview: {
      minutes: 7,
      pickCount: 2,
      questions: [
        "`startExamination` は `CheckedIn` だけを受け取り、会計済み・キャンセル済みを型で拒否しますか。",
        "`Canceled` の `reason` など、状態ごとの必須情報を省略できない型ですか。",
        "状態を追加したとき、`assertNever` によって未対応の分岐がコンパイルエラーになりますか。",
      ],
    },
  },
  {
    slug: "03-semantic-identifiers",
    adv: { articulate: 2, delegate: 9, verify: 2 },
    exerciseModule: {
      dir: "examples/session-03/src/domain",
      fileBudget: 5,
      lineBudget: 34,
    },
    solutionSnapshot: "session-04",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 7,
      pickCount: 2,
      questions: [
        "`PetId` と `OwnerId` を取り違えたコードは、型テストでコンパイルエラーになりますか。",
        "予約の全状態で、識別子が用途別の型になっていますか。",
        "状態遷移の引数に `string` が残らず、用途別の識別子を受け取っていますか。",
      ],
    },
  },
  {
    slug: "04-boundaries-and-pii",
    adv: { articulate: 2, delegate: 8, verify: 2 },
    exerciseModule: {
      dir: "examples/session-04/src/boundary",
      fileBudget: 2,
      lineBudget: 26,
    },
    solutionSnapshot: "session-05",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 7,
      pickCount: 2,
      questions: [
        "外部 JSON は、Zod の検証に成功したときだけ `ExamResult` になりますか。",
        "氏名・電話番号・メールは、`JSON.stringify` と `util.inspect` のどちらでも既定でマスクされますか。",
        "`OwnerContact` の各項目は、平文の `string` ではなく `Sensitive` になっていますか。",
      ],
    },
  },
  {
    slug: "05-workflow-errors",
    adv: { articulate: 2, delegate: 10, verify: 3 },
    exerciseModule: {
      dir: "examples/session-05/src/useCase",
      fileBudget: 3,
      lineBudget: 76,
    },
    solutionSnapshot: "session-06",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 8,
      pickCount: 2,
      questions: [
        "予約なしと状態不正は、異なる `kind` を持つ `Err` になっていますか。",
        "`andThen` は、成功したときだけ次の検証と状態遷移へ進みますか。",
        "業務エラーの後に、状態の保存が実行されない構造になっていますか。",
      ],
    },
  },
  {
    slug: "06-effects-and-consistency",
    adv: { articulate: 2, delegate: 10, verify: 3 },
    exerciseModule: {
      dir: "examples/session-06/src/useCase",
      fileBudget: 3,
      lineBudget: 55,
    },
    solutionSnapshot: "session-07",
    solutionPresentation: "completed-file",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 8,
      pickCount: 2,
      questions: [
        "時刻とイベント ID は実行ごとに一度だけ生成され、同じ `EventContext` に入りますか。",
        "状態と監査記録は、1つのイベントとして同じ `store` に渡されますか。",
        "業務上の競合だけを `Result` で返し、保存障害は reject のまま伝播しますか。",
      ],
    },
  },
] as const;

const expectedNavigation = [
  {
    previous: undefined,
    next: {
      href: "/sessions/01-business-events-and-workflows/",
      title: "ビジネスイベントからワークフローを描く",
    },
  },
  {
    previous: {
      href: "/sessions/00-system-handover/",
      title: "業務とシステムを引き継ぐ",
    },
    next: {
      href: "/sessions/02-state-transitions/",
      title: "予約の状態と遷移をモデル化する",
    },
  },
  {
    previous: {
      href: "/sessions/01-business-events-and-workflows/",
      title: "ビジネスイベントからワークフローを描く",
    },
    next: {
      href: "/sessions/03-semantic-identifiers/",
      title: "用途の異なる識別子を型で区別する",
    },
  },
  {
    previous: {
      href: "/sessions/02-state-transitions/",
      title: "予約の状態と遷移をモデル化する",
    },
    next: {
      href: "/sessions/04-boundaries-and-pii/",
      title: "外部入力を境界で検証し個人情報を守る",
    },
  },
  {
    previous: {
      href: "/sessions/03-semantic-identifiers/",
      title: "用途の異なる識別子を型で区別する",
    },
    next: {
      href: "/sessions/05-workflow-errors/",
      title: "失敗をワークフローの結果として扱う",
    },
  },
  {
    previous: {
      href: "/sessions/04-boundaries-and-pii/",
      title: "外部入力を境界で検証し個人情報を守る",
    },
    next: {
      href: "/sessions/06-effects-and-consistency/",
      title: "副作用と整合性境界を設計する",
    },
  },
  {
    previous: {
      href: "/sessions/05-workflow-errors/",
      title: "失敗をワークフローの結果として扱う",
    },
    next: {
      href: "/sessions/final/",
      title: "参照実装で境界をたどる",
    },
  },
  {
    previous: {
      href: "/sessions/06-effects-and-consistency/",
      title: "副作用と整合性境界を設計する",
    },
    next: undefined,
  },
] as const satisfies readonly SessionNavigation[];

describe("page-owned session contracts", () => {
  it("keeps the complete curriculum metadata in page order", () => {
    expect(
      sessions.map((session) => ({
        slug: session.slug,
        sequence: session.sequence,
        title: session.title,
        durationMinutes: session.durationMinutes,
        kind: session.kind,
        exerciseCommand: session.exerciseCommand,
        snapshot: session.snapshot,
        timeBreakdown: session.timeBreakdown,
      })),
    ).toEqual(expectedCurriculum);
    expect(new Set(sessions.map(({ slug }) => slug)).size).toBe(8);
    expect(new Set(sessions.map(({ sequence }) => sequence)).size).toBe(8);
  });

  it("keeps the 180-minute schedule and each time allocation consistent", () => {
    expect(
      sessions.reduce((sum, { durationMinutes }) => sum + durationMinutes, 0),
    ).toBe(180);
    for (const session of sessions) {
      expect(
        Object.values(session.timeBreakdown).reduce(
          (sum, duration) => sum + duration,
          0,
        ),
        session.slug,
      ).toBe(session.durationMinutes);
    }
  });

  it("keeps the complete exercise, solution, and peer-review contracts", () => {
    expect(
      exerciseSessions.map((session) => ({
        slug: session.slug,
        adv: session.adv,
        exerciseModule: session.exerciseModule,
        solutionSnapshot: session.solutionSnapshot,
        solutionPresentation: session.solutionPresentation,
        peerReviewPromises: session.peerReviewPromises,
        peerReview: session.peerReview,
      })),
    ).toEqual(expectedExercises);

    for (const session of exerciseSessions) {
      expect(
        Object.values(session.adv).reduce((sum, value) => sum + value, 0),
        session.slug,
      ).toBe(session.timeBreakdown.exercise);
      expect(session.peerReview.minutes).toBe(session.timeBreakdown.review);
      expect(session.exerciseModule.fileBudget).toBeLessThanOrEqual(5);
      expect(session.exerciseModule.lineBudget).toBeLessThanOrEqual(80);
    }
  });

  it("keeps exercise targets and solutions inside their declared snapshots", () => {
    for (const session of exerciseSessions) {
      expect(session.steps.length).toBeGreaterThanOrEqual(1);
      expect(session.steps.length).toBeLessThanOrEqual(4);
      expect(session.decisions.length).toBeGreaterThanOrEqual(1);
      expect(session.decisions.length).toBeLessThanOrEqual(3);
      expect(session.incident.trim()).not.toBe("");

      for (const decision of session.decisions) {
        expect(decision.invariant.trim()).not.toBe("");
      }
      for (const step of session.steps) {
        expect(step.solutions.length).toBeGreaterThanOrEqual(1);
        for (const target of step.targets) {
          expect(target).toMatch(
            new RegExp(`^${session.exerciseModule.dir}/`),
          );
        }
        for (const solution of step.solutions) {
          expect(solution.path).toMatch(
            new RegExp(`^examples/${session.solutionSnapshot}/`),
          );
          expect(solution.presentation ?? "excerpt").toBe(
            session.solutionPresentation,
          );
        }
      }
    }

    const injectContext = exerciseSessions
      .find(({ slug }) => slug === "06-effects-and-consistency")
      ?.steps.find(({ id }) => id === "s6-inject-context");
    expect(injectContext?.solutions).toEqual([
      expect.objectContaining({
        path: "examples/session-07/src/useCase/dependencies.ts",
        symbol: "EventContextDependencies",
      }),
      expect.objectContaining({
        path: "examples/session-07/src/useCase/startExamination.ts",
        symbol: "createEventContext",
      }),
    ]);
  });

  it("keeps exercise-only fields off non-exercise pages", () => {
    for (const session of sessions.filter(({ kind }) => kind !== "exercise")) {
      expect(session.adv).toBeUndefined();
      expect(session.peerReview).toBeUndefined();
      expect(session.exerciseCommand).toBeUndefined();
      expect(session.exerciseModule).toBeUndefined();
      expect(session.solutionSnapshot).toBeUndefined();
      expect(session.solutionPresentation).toBeUndefined();
      expect(session.peerReviewPromises).toBeUndefined();
      expect(session.steps).toHaveLength(0);
      expect(session.decisions).toHaveLength(0);
    }
  });

  it("keeps fixed previous and next navigation on all eight pages", () => {
    expect(pages.map(({ navigation }) => navigation)).toEqual(
      expectedNavigation,
    );
  });
});
