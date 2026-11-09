import type { CodeGuide } from "../../code-explorer/code-guide";
import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import type { SessionWorkspace } from "../../code-explorer/types";
import { blockOf } from "../source-quotes";
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
    questions: [
      "時刻とイベント ID は実行ごとに一度だけ生成され、同じ `EventContext` に入りますか。",
      "状態と監査記録は、1つのイベントとして同じ `store` に渡されますか。",
      "業務上の競合だけを `Result` で返し、保存障害は reject のまま伝播しますか。",
    ],
  },
  solutionSnapshot: "session-06-solution",
  solutionPresentation: "completed-file",
  peerReviewPromises: "reference",
  animal: { name: "TURTLE", type: "turtle", avatar: "🐢" },
  summary: "診察開始で予約の状態と監査記録が片方だけ残る問題と、テストの結果が時刻で変わる問題を解き、直した状態を仕組みで守ります。",
  episode: [
    "カメの診察を開始すると、予約状態だけが先に更新され、監査記録はどこにも残りませんでした。",
    "記録がないので、誰がいつ診察を開始したかを後から調べられません。",
    "再現テストでは時刻とイベント ID が毎回変わり、失敗したときの値を同じ形で確かめられません。",
  ],
  incident: "実行のたびに変わる値でテスト結果が安定せず、状態だけ保存され監査記録が残らない予約が生まれた。",
  exerciseCommand: "pnpm exercise:06",
  exerciseModule: {
    dir: "examples/session-06/src/useCase",
    fileBudget: 3,
    lineBudget: 55,
  },
  delegationPrompt: {
    decisions: [
      "実行ごとに変わる値をいつ生成するか",
      "どの状態と記録を同時に保存するか",
      "保存障害をどの境界まで伝えるか",
    ],
  },
  steps: [
    {
      id: "s06-inject-context",
      goal: "Clock と ID generator を使って EventContext を一度だけ生成する。",
      startingFailure: "同じ条件で実行しても、時刻とイベント ID が毎回変わる。",
      targets: [
        "examples/session-06/src/useCase/dependencies.ts",
        "examples/session-06/src/useCase/startExamination.ts",
      ],
      solutions: [
        {
          path: "examples/session-06-solution/src/useCase/dependencies.ts",
          symbol: "EventContextDependencies",
          lines: [1, 35],
          presentation: "completed-file",
        },
        {
          path: "examples/session-06-solution/src/useCase/startExamination.ts",
          symbol: "createEventContext",
          lines: [1, 90],
          presentation: "completed-file",
        },
      ],
    },
    {
      id: "s06-atomic-store",
      goal: "状態と監査記録を1回の保存で残す。",
      startingFailure: "状態と監査記録を別々に保存している。",
      targets: ["examples/session-06/src/useCase/dependencies.ts"],
      solutions: [
        {
          path: "examples/session-06-solution/src/useCase/dependencies.ts",
          symbol: "ExaminationStartedStore",
          lines: [1, 35],
          presentation: "completed-file",
        },
      ],
    },
    {
      id: "s06-result-async",
      goal: "非同期で保存しても、イベントを結果として返す。",
      startingFailure: "保存後に、更新した予約の状態を受け取れない。",
      targets: ["examples/session-06/src/useCase/startExamination.ts"],
      solutions: [{
        path: "examples/session-06-solution/src/useCase/startExamination.ts",
        symbol: "startExaminationWithEffects",
        lines: [1, 90],
        presentation: "completed-file",
      }],
    },
    {
      id: "s06-propagate-store-failure",
      goal: "競合は Err で返し、保存障害は Err へ変換せず、例外として外側の境界へ伝播する。",
      startingFailure: "競合を Err で返せない。",
      targets: [
        "examples/session-06/src/useCase/errors.ts",
        "examples/session-06/src/useCase/startExamination.ts",
      ],
      solutions: [
        {
          path: "examples/session-06-solution/src/useCase/errors.ts",
          symbol: "AppointmentConflict",
          lines: [1, 39],
          presentation: "completed-file",
        },
        {
          path: "examples/session-06-solution/src/useCase/startExamination.ts",
          symbol: "startExaminationWithEffects",
          lines: [1, 90],
          presentation: "completed-file",
        },
      ],
    },
  ],
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
    title: "時刻と ID を処理の中で直接作っている",
    currentDesign: "new Date() と crypto.randomUUID() を直接呼び、イベントの時刻と ID を作っています。",
    futureRisk: "同じ入力でも出力のイベントが変わるので、テストの期待値を固定できません。",
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
] as const) satisfies readonly CodeGuide[];

export const workspace = ({
  slug: session.slug,
  snapshot: session.snapshot,
  initialFile: "exercises/effects-and-events.test.ts",
  description: "出力イベントと副作用の要求を、開始スナップショットで確認します。",
  visibleFiles: [
    "exercises/effects-and-events.test.ts",
    "test/regression/result-errors.test.ts",
    "src/domain/aggregate/clock.ts",
    "src/domain/aggregate/eventContext.ts",
    "src/domain/aggregate/eventId.ts",
    "src/domain/aggregate/eventIdGenerator.ts",
    "src/domain/appointment/examinationStarted.ts",
    "src/useCase/dependencies.ts",
    "src/useCase/errors.ts",
    "src/useCase/startExamination.ts",
    "src/shared/schemaResult.ts",
    "src/shared/sensitive.ts",
  ],
} as const) satisfies SessionWorkspace;

export const promisesHref =
  "/sessions/01-state-transitions/peer-review/#peer-review-promises";

export const navigation = ({
  previous: {
    href: "/sessions/05-business-events-and-workflows/",
    title: "データとパイプラインで予約キャンセルを設計する",
  },
  next: {
    href: "/sessions/final/",
    title: "参照実装で境界をたどる",
  },
} as const);

export const projectFiles = projectFilesForSnapshot(session.snapshot);

const solutionFiles = projectFilesForSnapshot("session-06-solution");

const dedent = (code: string): string => {
  const lines = code.split("\n");
  const indent = Math.min(
    ...lines.filter((line) => line.trim() !== "").map((line) => line.search(/\S/)),
  );
  return lines.map((line) => line.slice(indent)).join("\n");
};

const reflow = (
  code: string,
  breaks: ReadonlyArray<readonly [line: string, replacement: string]>,
): string =>
  breaks.reduce((current, [line, replacement]) => {
    if (!current.includes(line)) throw new Error(`${line} is not in the quoted code`);
    return current.replace(line, () => replacement);
  }, code);

export const storeCode = {
  sqlite: {
    path: "src/adaptor/secondary/sqlite/examinationStartedStore.ts",
    code: reflow(
      dedent(
        blockOf(
          solutionFiles,
          "src/adaptor/secondary/sqlite/examinationStartedStore.ts",
          "    database.transaction((transaction) => {",
          "    });",
        ),
      ),
      [
        [
          "  const current = findInTransaction(transaction, event.appointmentId);",
          "  const current =\n    findInTransaction(transaction, event.appointmentId);",
        ],
        [
          '  if (current === undefined || current.kind !== "CheckedIn") {',
          '  if (current === undefined ||\n    current.kind !== "CheckedIn") {',
        ],
      ],
    ),
  },
  inMemory: {
    path: "src/adaptor/inMemoryExaminationStartedStore.ts",
    code: reflow(
      dedent(
        blockOf(
          solutionFiles,
          "src/adaptor/inMemoryExaminationStartedStore.ts",
          "          const currentAppointment = appointments.get(event.appointmentId);",
          "          events = nextEvents;",
        ),
      ),
      [
        [
          "const currentAppointment = appointments.get(event.appointmentId);",
          "const currentAppointment =\n  appointments.get(event.appointmentId);",
        ],
        [
          "  throw new Error(`Appointment missing at commit: ${event.appointmentId}`);",
          "  throw new Error(\n    `Appointment missing at commit: ${event.appointmentId}`,\n  );",
        ],
        [
          "nextAppointments.set(event.appointmentId, event.aggregateState);",
          "nextAppointments.set(\n  event.appointmentId, event.aggregateState);",
        ],
      ],
    ),
  },
};
