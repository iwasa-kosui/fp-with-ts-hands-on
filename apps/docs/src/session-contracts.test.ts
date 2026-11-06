import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  paymentAmountQuote,
  supplementaryExercise,
} from "./pages/sessions/04-boundaries-and-pii.astro";
import { sessionNavigationItems } from "./sessions/navigation";
import type { SessionNavigation, SessionSummary } from "./sessions/types";
type PageModule = Readonly<{
  session: SessionSummary;
  navigation?: SessionNavigation;
}>;

const pageModules = import.meta.glob<PageModule>([
  "./pages/sessions/*.astro",
  "!./pages/sessions/index.astro",
], {
  eager: true,
});
const pageSources = import.meta.glob<string>([
  "./pages/sessions/*.astro",
  "!./pages/sessions/index.astro",
], {
  eager: true,
  query: "?raw",
  import: "default",
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
    title: "データとパイプラインで予約キャンセルを設計する",
    durationMinutes: 15,
    kind: "workshop",
    exerciseCommand: undefined,
    snapshot: undefined,
    timeBreakdown: { brief: 2, teach: 7, exercise: 4, review: 2 },
  },
  {
    slug: "02-state-transitions",
    sequence: "02",
    title: "予約の状態と遷移をモデル化する",
    durationMinutes: 20,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:02",
    snapshot: "session-02",
    timeBreakdown: { brief: 3, teach: 6, exercise: 8, review: 3 },
  },
  {
    slug: "03-adt-and-exhaustiveness",
    sequence: "03",
    title: "予約の状態の分岐漏れを型で検出する",
    durationMinutes: 20,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:02",
    snapshot: "session-02",
    timeBreakdown: { brief: 3, teach: 7, exercise: 7, review: 3 },
  },
  {
    slug: "04-boundaries-and-pii",
    sequence: "04",
    title: "診察開始の入力を境界で検証する",
    durationMinutes: 35,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:04",
    snapshot: "session-04",
    timeBreakdown: { brief: 3, teach: 10, exercise: 15, review: 7 },
  },
  {
    slug: "05-workflow-errors",
    sequence: "05",
    title: "失敗をユースケースの結果として扱う",
    durationMinutes: 35,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:05",
    snapshot: "session-05",
    timeBreakdown: { brief: 4, teach: 13, exercise: 10, review: 8 },
  },
  {
    slug: "06-effects-and-consistency",
    sequence: "06",
    title: "副作用と整合性境界を設計する",
    durationMinutes: 40,
    kind: "exercise",
    exerciseCommand: "pnpm exercise:06",
    snapshot: "session-06",
    timeBreakdown: { brief: 4, teach: 13, exercise: 15, review: 8 },
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

const expectedEpisodes = [
  [
    "新人エンジニアの初出勤を歓迎するように、犬が観葉植物を倒し、プリンターは事故報告を吐き続けていました。",
    "会計済みの予約は「診察中」へ戻り、請求書は2枚。ログには飼い主の電話番号まで律儀にそろっています。",
    "引き継ぎ資料を開く前に、二重請求と個人情報流出の再現条件だけは確認できました。",
  ],
  [
    "会計済みの予約を、受付担当者が誤ってキャンセルできました。",
    "理由のないキャンセルがStoreへ記録され、どの条件を確認したか説明できません。",
    "実装へ進む前に、予約のデータと、キャンセルでデータがどう変わるかを確かめます。",
  ],
  [
    "会計を終えたウサギは帰ったはずなのに、画面の中では診察室へ戻ってきました。",
    "受付画面は止めるどころか、2枚目の請求書まで手際よく用意します。",
    "許可された状態遷移を覚えていたのは人間だけで、コードは何でも通す危ない設計でした。",
  ],
  [
    "無断キャンセルを表すNoShowの状態を足した翌朝、受付画面のハリネズミの予約に「不明」と表示されていました。",
    "表示名の分岐にNoShowのcaseがなく、defaultが「不明」を返していても、型検査は成功しました。",
    "状態を足したときは、直し忘れた分岐をコンパイラに見つけさせる必要があります。",
  ],
  undefined,
  [
    "別の端末で受付情報が更新された後、古い画面に残っていたハムスターの診察開始ボタンを押すと、500エラーだけを返して止まりました。",
    "予約なしは専用表示になるのに、受付前の予約は想定外扱いです。後ろでは犬が吠え、列だけが伸びます。",
    "新しい例外を投げた側は、呼び出し側のcatch漏れを型から確かめられませんでした。",
  ],
  [
    "カメの診察を開始すると、予約状態だけが先に更新され、監査記録はどこにも残りませんでした。",
    "再現テストでは時刻とイベント ID が毎回変わり、失敗の証拠まで落ち着きがありません。",
    "状態更新は即決、記録保存は自由行動。原因究明だけが残業します。",
  ],
  [
    "ここまで直した頃、猫のムギはとっくに帰宅し、開発者だけが参照実装の前に残っていました。",
    "入力、失敗、イベント、保存、例外を順に追うと、さっきまでの事故がそれぞれ決まった場所で待っています。",
    "完成形と呼んでも、事故が消えたわけではありません。置き場所と担当が決まっただけです。",
  ],
] as const;

const expectedExercises = [
  {
    slug: "02-state-transitions",
    adv: { articulate: 2, delegate: 4, verify: 2 },
    exerciseModule: {
      dir: "examples/session-02/src/domain/appointment",
      fileBudget: 1,
      lineBudget: 35,
    },
    solutionSnapshot: "session-03",
    solutionPresentation: "excerpt",
    peerReviewPromises: "inline",
    peerReview: {
      minutes: 3,
      pickCount: 2,
      questions: [
        "`startExamination` は `CheckedIn` だけを受け取り、会計済み・キャンセル済みを型で拒否しますか。",
        "`recordPayment` は `AwaitingPayment` だけを受け取り、診察結果の記録前には会計できない型ですか。",
      ],
    },
  },
  {
    slug: "03-adt-and-exhaustiveness",
    adv: { articulate: 1, delegate: 5, verify: 1 },
    exerciseModule: {
      dir: "examples/session-02/src/domain/appointment",
      fileBudget: 1,
      lineBudget: 6,
    },
    solutionSnapshot: "session-03",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 3,
      pickCount: 1,
      questions: [
        "状態を追加したとき、`assertNever` によって未対応の分岐がコンパイルエラーになりますか。",
        "`toStatusLabel` は `Readonly<{ kind: string }>` ではなく、`Appointment` を受け取っていますか。",
        "`default` 分岐は固定の表示名を返さず、`assertNever` に `appointment` を渡していますか。",
      ],
    },
  },
  {
    slug: "04-boundaries-and-pii",
    adv: { articulate: 2, delegate: 11, verify: 2 },
    exerciseModule: {
      dir: "examples/session-04/src/boundary",
      fileBudget: 1,
      lineBudget: 18,
    },
    solutionSnapshot: "session-05",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 7,
      pickCount: 2,
      questions: [
        "不正な予約IDまたは獣医師IDを含む入力は、`StartExaminationInput` になりませんか。",
        "`parse` は外部入力を `unknown` として受け取っていますか。",
        "検証に成功した場合だけ、`AppointmentId` と `VeterinarianId` をユースケースへ渡せますか。",
      ],
    },
  },
  {
    slug: "05-workflow-errors",
    adv: { articulate: 2, delegate: 5, verify: 3 },
    exerciseModule: {
      dir: "examples/session-05/src",
      fileBudget: 3,
      lineBudget: 80,
    },
    solutionSnapshot: "session-06",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    peerReview: {
      minutes: 8,
      pickCount: 2,
      questions: [
        "予約なしと状態不正は、異なる `kind` を持つ `Err` になっていますか。",
        "`andThen` は、失敗後の状態遷移と保存を実行しない構造になっていますか。",
        "Web側は業務エラーを `kind` で網羅し、未対応の種類を型エラーにできますか。",
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
      title: "データとパイプラインで予約キャンセルを設計する",
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
      title: "データとパイプラインで予約キャンセルを設計する",
    },
    next: {
      href: "/sessions/03-adt-and-exhaustiveness/",
      title: "予約の状態の分岐漏れを型で検出する",
    },
  },
  {
    previous: {
      href: "/sessions/02-state-transitions/",
      title: "予約の状態と遷移をモデル化する",
    },
    next: {
      href: "/sessions/04-boundaries-and-pii/",
      title: "診察開始の入力を境界で検証する",
    },
  },
  {
    previous: {
      href: "/sessions/03-adt-and-exhaustiveness/",
      title: "予約の状態の分岐漏れを型で検出する",
    },
    next: {
      href: "/sessions/05-workflow-errors/",
      title: "失敗をユースケースの結果として扱う",
    },
  },
  {
    previous: {
      href: "/sessions/04-boundaries-and-pii/",
      title: "診察開始の入力を境界で検証する",
    },
    next: {
      href: "/sessions/06-effects-and-consistency/",
      title: "副作用と整合性境界を設計する",
    },
  },
  {
    previous: {
      href: "/sessions/05-workflow-errors/",
      title: "失敗をユースケースの結果として扱う",
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

  it("keeps the session rail aligned with page-owned metadata", () => {
    expect(sessionNavigationItems).toEqual(
      sessions.map(({ slug, title }) => ({ slug, title })),
    );
  });

  it("keeps each three-line episode in its page metadata and hero", () => {
    expect(
      sessions.map((session) =>
        session.slug === "04-boundaries-and-pii"
          ? undefined
          : "episode" in session
            ? session.episode
            : undefined,
      ),
    ).toEqual(expectedEpisodes);

    const boundaryEpisode = sessions.find(
      ({ slug }) => slug === "04-boundaries-and-pii",
    )?.episode;
    expect(boundaryEpisode).toHaveLength(3);
    expect(boundaryEpisode?.join("\n")).toContain("night-shift");
    expect(boundaryEpisode?.join("\n")).toContain("veterinarianId");
    expect(boundaryEpisode?.join("\n")).toContain("StartExaminationInput");

    for (const { path } of pages) {
      const source = pageSources[path] ?? "";
      expect(source, path).toContain('class="case-file__episode"');
      expect(source, path).toContain('class="case-file__episode-label"');
      expect(source, path).toContain("session.episode.map");
    }
  });

  it("describes the Session 00 SQLite incident baseline without a legacy path", () => {
    const source = pageSources["./pages/sessions/00-system-handover.astro"];

    expect(source).toContain("SQLite");
    expect(source).toContain("現在の予約内容");
    expect(source).toContain("予約の変更履歴");
    expect(source).toContain("個人情報");
    expect(source).not.toContain("src/legacy");
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
            new RegExp(
              solution.sourcePath === undefined
                ? `^examples/${session.solutionSnapshot}/`
                : `^${session.exerciseModule.dir}/`,
            ),
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

  it("keeps the semantic identifier supplementary exercise with its owning concepts", () => {
    const workflowErrors = exerciseSessions.find(
      ({ slug }) => slug === "05-workflow-errors",
    );

    expect(supplementaryExercise.exerciseCommand).toBe("pnpm exercise:03");
    expect(supplementaryExercise.solutionSnapshot).toBe("session-04");
    expect(supplementaryExercise.steps[0]?.targets).toEqual([
      "examples/session-03/src/domain/appointment/appointmentId.ts",
      "examples/session-03/src/domain/appointment/veterinarianId.ts",
    ]);
    expect(supplementaryExercise.steps[0]?.solutions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "examples/session-04/src/domain/appointment/appointmentId.ts",
        }),
        expect.objectContaining({
          path: "examples/session-04/src/domain/appointment/veterinarianId.ts",
        }),
      ]),
    );
    for (const step of supplementaryExercise.steps) {
      for (const target of step.targets) {
        expect(target).toMatch(
          new RegExp(`^${supplementaryExercise.exerciseModule.dir}/`),
        );
      }
      for (const solution of step.solutions) {
        expect(solution.path).toMatch(
          new RegExp(`^examples/${supplementaryExercise.solutionSnapshot}/`),
        );
      }
    }
    expect(workflowErrors?.steps.flatMap(({ targets }) => targets)).not.toContain(
      "examples/session-05/src/domain/ids/appointmentId.ts",
    );
  });

  it("quotes PaymentAmount verbatim from the final snapshot", async () => {
    const source = await readFile(
      resolve(process.cwd(), "../..", paymentAmountQuote.source),
      "utf8",
    );

    expect(source).toContain(paymentAmountQuote.code);
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
