import type { CodeGuide } from "../../code-explorer/code-guide";
import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import type { SessionWorkspace } from "../../code-explorer/types";
import type { SessionSummary } from "../types";

export const session: SessionSummary = {
  slug: "06-effects-and-consistency",
  snapshot: "session-06",
  sequence: "06",
  kind: "exercise",
  title: "副作用と整合性境界を設計する",
  durationMinutes: 36,
  timeBreakdown: { brief: 3, teach: 13, exercise: 15, review: 5 },
  adv: { articulate: 2, delegate: 10, verify: 3 },
  peerReview: {
    minutes: 5,
    pickCount: 2,
    questions: ["検出されなかった変更を検出するには、何を追加すればよいか"],
  },
  solutionSnapshot: "session-06-solution",
  solutionPresentation: "completed-file",
  peerReviewPromises: "reference",
  animal: { name: "TURTLE", type: "turtle", avatar: "🐢" },
  summary: "診察開始で予約の状態と監査記録が片方だけ残る問題と、テストの結果が時刻で変わる問題を解き、直した状態を仕組みで守ります。",
  episode: [
    "カメの診察を開始すると、予約状態だけが先に更新され、監査記録はどこにも残りませんでした。",
    "記録がないため、誰がいつ診察を開始したかを後から調査できません。",
    "再現テストでは時刻とイベント ID が毎回変わり、失敗したときの値を同じ形で確認できません。",
  ],
  incident: "実行のたびに変わる値でテスト結果が安定せず、状態だけ保存され監査記録が残らない予約が生まれた。",
  delegationPrompt: {
    decisions: [
      "実行ごとに変わる値をいつ生成するか",
      "どの状態と記録を同時に保存するか",
      "保存障害をどの境界まで伝えるか",
    ],
  },
  decisions: [
    {
      invariant: "時刻とイベント ID は1回のユースケース実行で一度だけ生成し、同じ実行コンテキストから状態と監査記録を作る。",
    },
    {
      invariant: "状態と監査記録は同時に残るか、どちらも残らない。",
    },
    {
      invariant: "保存障害を、利用者が次の操作を選べる業務の失敗へ偽装しない。",
    },
  ],
  finalReferences: [
    "examples/final/src/domain/aggregate/clock.ts",
    "examples/final/src/domain/aggregate/eventIdGenerator.ts",
    "examples/final/src/domain/aggregate/eventContext.ts",
    "examples/final/src/domain/aggregate/aggregateStore.ts",
    "examples/final/src/domain/appointment/appointmentStores.ts",
    "examples/final/src/useCase/startExaminationUseCase.ts",
    "examples/final/src/app.ts",
  ],
};

export const guides = ([
  {
    id: "hidden-nondeterminism",
    title: "時刻と ID を処理の中で直接生成している",
    currentDesign: "new Date() と crypto.randomUUID() を直接呼び出し、イベントの時刻と ID を生成しています。",
    futureRisk: "同じ入力でも出力のイベントが変わるため、テストの期待値を固定できません。",
    path: "src/useCase/startExamination.ts",
    highlights: [
      { startLineNumber: 51, endLineNumber: 51 },
      { startLineNumber: 63, endLineNumber: 63 },
    ],
  },
  {
    id: "dual-write",
    title: "状態と監査記録の保存が2回に分かれている",
    currentDesign: "stateStore.save と eventLog.append を続けて await しています。",
    futureRisk: "2回目の保存だけ失敗すると、片方だけが残ります。",
    path: "src/useCase/startExamination.ts",
    highlights: [{ startLineNumber: 69, endLineNumber: 70 }],
  },
  {
    id: "unchecked-current-state",
    title: "保存時に現在の状態を検証していない",
    currentDesign: "S04 の startExamination の判定だけを流用するため、何も保存しない store を渡します。中央のカードの stateStore.save は現在の状態を検証せず書き込みます。",
    futureRisk: "別の依頼が先に診察を開始していても、結果は Ok のままです。",
    path: "src/useCase/startExamination.ts",
    highlights: [{ startLineNumber: 52, endLineNumber: 55 }],
  },
] as const) satisfies readonly CodeGuide[];

export const workspace = ({
  slug: session.slug,
  snapshot: session.snapshot,
  initialFile: "test/regression/result-errors.test.ts",
  description: "出力イベントと副作用の要求を、開始スナップショットで確認します。",
  visibleFiles: [
    "test/regression/result-errors.test.ts",
    "src/domain/aggregate/clock.ts",
    "src/domain/aggregate/eventContext.ts",
    "src/domain/aggregate/eventId.ts",
    "src/domain/aggregate/eventIdGenerator.ts",
    "src/domain/appointment/examinationStarted.ts",
    "src/useCase/dependencies.ts",
    "src/useCase/errors.ts",
    "src/useCase/startExamination.ts",
    "src/domain/shared/schemaResult.ts",
    "src/domain/shared/sensitive.ts",
  ],
} as const) satisfies SessionWorkspace;

export const promisesHref =
  "/sessions/01-state-transitions/peer-review/#peer-review-promises";

export const navigation = ({
  previous: {
    href: "/sessions/05-business-events-and-workflows/",
    title: "データと工程で予約キャンセルを設計する",
  },
  next: {
    href: "/sessions/final/",
    title: "参照実装で境界を追跡する",
  },
} as const);

export const projectFiles = projectFilesForSnapshot(session.snapshot);
