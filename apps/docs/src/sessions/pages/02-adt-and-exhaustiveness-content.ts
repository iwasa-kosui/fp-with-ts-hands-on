import type { CodeGuide } from "../../code-explorer/code-guide";
import type { SessionWorkspace } from "../../code-explorer/types";
import type { SessionSummary } from "../types";

export const session: SessionSummary = {
  slug: "02-adt-and-exhaustiveness",
  snapshot: "session-02",
  sequence: "02",
  kind: "exercise",
  title: "予約の状態の分岐漏れを型で検出する",
  durationMinutes: 20,
  timeBreakdown: { brief: 2, teach: 8, exercise: 7, review: 3 },
  adv: { articulate: 1, delegate: 5, verify: 1 },
  peerReview: {
    minutes: 3,
    pickCount: 1,
    questions: [
      "検出されなかった変更は何を変えたのか",
      "その変更を検出するには何を追加すればよいか",
      "追加した仕組みで誤検知は発生しないか",
    ],
  },
  solutionSnapshot: "session-02-solution",
  solutionPresentation: "excerpt",
  peerReviewPromises: "reference",
  animal: { name: "HEDGEHOG", type: "hedgehog", avatar: "🦔" },
  summary: "予約の状態ごとの分岐を網羅し、状態を追加したときの未対応の分岐を型検査で検出します。",
  episode: [
    "無断キャンセルを表すNoShowの状態を追加した翌朝、受付画面のハリネズミの予約に「不明」と表示されていました。",
    "表示名の分岐にNoShowのcaseがなく、defaultが「不明」を返していても、型検査は成功しました。",
    "状態を追加したときは、対応漏れの分岐をコンパイラに検出させる必要があります。",
  ],
  incident: "NoShowの状態を追加したとき、表示名の分岐が default で「不明」を返し、型検査は成功した。",
  exerciseCommand: "pnpm exercise:02",
  exerciseModule: {
    dir: "examples/session-02/src/domain/appointment",
    fileBudget: 1,
    lineBudget: 6,
  },
  delegationPrompt: {
    decisions: [
      "状態追加時の分岐漏れをどこで検出するか",
    ],
  },
  steps: [
    {
      id: "s02-exhaustive-label",
      goal: "状態を追加したら表示名の分岐をコンパイルエラーにする。",
      startingFailure: "状態を追加しても、表示名の分岐漏れを検出できない。",
      targets: ["examples/session-02/src/domain/appointment/statusLabel.ts"],
      solutions: [{
        path: "examples/session-02-solution/src/domain/appointment/statusLabel.ts",
        symbol: "toStatusLabel",
        lines: [3, 24],
      }],
    },
  ],
  decisions: [
    {
      invariant: "状態を追加したとき、未対応の分岐をコンパイルエラーにする。",
    },
  ],
  finalReferences: [
    "examples/final/src/domain/shared/assertNever.ts",
  ],
};

export const guides = ([
  {
    id: "string-kind-label",
    title: "表示名の関数が kind を string として受け取っている",
    currentDesign: "toStatusLabel の引数が kind: string で、Appointment の状態に限られていません。",
    futureRisk: "存在しない kind の値を渡しても、コンパイルが通ります。",
    path: "src/domain/appointment/statusLabel.ts",
    highlights: [{ startLineNumber: 3, endLineNumber: 3 }],
  },
  {
    id: "non-exhaustive-label",
    title: "表示名の分岐が未知の状態を検出しない",
    currentDesign: "default で「不明」を返し、すべての状態を処理したかを型で検証していません。",
    futureRisk: "状態を追加しても、未対応の分岐がコンパイルエラーになりません。",
    path: "src/domain/appointment/statusLabel.ts",
    highlights: [{ startLineNumber: 4, endLineNumber: 19 }],
  },
] as const) satisfies readonly CodeGuide[];

export const workspace = ({
  slug: session.slug,
  snapshot: session.snapshot,
  initialFile: "exercises/state-modeling.test.ts",
  description: "表示名の分岐と予約状態の定義を、開始スナップショットで確認します。",
  visibleFiles: [
    "exercises/state-modeling.test.ts",
    "src/domain/appointment/appointment.ts",
    "src/domain/appointment/statusLabel.ts",
  ],
} as const) satisfies SessionWorkspace;

export const promisesHref =
  "/sessions/01-state-transitions/peer-review/#peer-review-promises";

export const navigation = ({
  previous: {
    href: "/sessions/01-state-transitions/",
    title: "予約の状態と遷移をモデル化する",
  },
  next: {
    href: "/sessions/03-boundaries-and-pii/",
    title: "診察開始の入力を境界で検証する",
  },
} as const);
