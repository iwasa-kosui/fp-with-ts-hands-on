import type { CodeGuide } from "../../code-explorer/code-guide";
import type { SessionWorkspace } from "../../code-explorer/types";
import type { SessionSummary } from "../types";

export const session: SessionSummary = {
  slug: "01-state-transitions",
  snapshot: "session-01",
  sequence: "01",
  kind: "exercise",
  title: "予約の状態と遷移をモデル化する",
  durationMinutes: 20,
  timeBreakdown: { brief: 2, teach: 7, exercise: 8, review: 3 },
  adv: { articulate: 2, delegate: 4, verify: 2 },
  peerReview: {
    minutes: 3,
    pickCount: 2,
    questions: [
      "検出されなかった変更は何を変えたのか",
      "その変更を検出するには何を追加すればよいか",
      "追加した仕組みで誤検知は発生しないか",
    ],
  },
  solutionSnapshot: "session-01-solution",
  solutionPresentation: "excerpt",
  peerReviewPromises: "inline",
  animal: { name: "RABBIT", type: "rabbit", avatar: "🐇" },
  summary: "遷移関数の引数を絞り、許されない呼び出しを実行前に検出し、以後の変更でも検出されるようにします。",
  episode: [
    "会計担当は診察を終えた Mugi の飼い主から4,800円を受け取り、予約を会計済みにしました。",
    "その後、獣医師が別の予約と取り違えて、この会計済みの予約で「診察を開始する」を押しました。",
    "システムは操作を拒否せず、予約を診察中へ戻しました。受付は画面から会計前の来院と判断し、会計担当が飼い主へ同じ金額を再度請求しました。",
  ],
  incident: "会計済みの予約が診察中へ戻され、同じ金額が2回請求された。",
  exerciseCommand: "pnpm exercise:01",
  exerciseModule: {
    dir: "examples/session-01/src/domain/appointment",
    fileBudget: 1,
    lineBudget: 35,
  },
  delegationPrompt: {
    decisions: [
      "どの状態からどの状態への遷移を許可するか",
      "各状態で必須にする情報は何か",
    ],
  },
  steps: [
    {
      id: "s01-narrow-start",
      goal: "会計済み・キャンセル済みの来院で診察を開始するコードを、コンパイルエラーにする。",
      startingFailure: "会計済み・キャンセル済みの予約を渡す呼び出しが、型検査を通る。",
      targets: ["examples/session-01/src/domain/appointment/transitions.ts"],
      solutions: [{
        path: "examples/session-01-solution/src/domain/appointment/transitions.ts",
        symbol: "startExamination",
        lines: [16, 26],
      }],
    },
    {
      id: "s01-require-cancel-reason",
      goal: "キャンセルには必ず理由を残す。",
      startingFailure: "理由を渡さない呼び出しが、型検査を通る。",
      targets: ["examples/session-01/src/domain/appointment/transitions.ts"],
      solutions: [{
        path: "examples/session-01-solution/src/domain/appointment/transitions.ts",
        symbol: "cancel",
        lines: [47, 60],
      }],
    },
    {
      id: "s01-align-transitions",
      goal: "診察結果の記録前に会計するコードをコンパイルエラーにし、残りの遷移関数も、許可された状態だけを引数で受け取る形にそろえる。",
      startingFailure: "診察結果の記録前や、許可されていない状態の予約を渡す呼び出しが、型検査を通る。",
      targets: ["examples/session-01/src/domain/appointment/transitions.ts"],
      solutions: [{
        path: "examples/session-01-solution/src/domain/appointment/transitions.ts",
        symbol: "checkIn",
        lines: [13, 45],
      }],
    },
  ],
  decisions: [
    {
      invariant: "診察結果の記録前の会計と、許可されていない状態遷移を、型検査で拒否する。",
    },
    {
      invariant: "各状態に必要な情報が欠けた予約の値を、型で作れないようにする。",
    },
  ],
  finalReferences: [
    "examples/final/src/domain/appointment/appointment.ts",
  ],
};

export const guides = ([
  {
    id: "wide-transition-input",
    title: "遷移関数が Appointment 全体を受け取っている",
    currentDesign: "遷移関数の引数を現在の状態の型に絞らず、実行時の requireKind と throw で拒否しています。completeExamination と recordPayment も同じ形です。Appointment[\"kind\"] は、Appointment の kind プロパティの型を取り出す書き方です。",
    futureRisk: "禁止したい状態の値を渡してもコンパイルが通ります。また、結果を as で Appointment に型指定しているため、型検査は結果の誤りを検出できません。",
    path: "src/domain/appointment/transitions.ts",
    highlights: [
      { startLineNumber: 8, endLineNumber: 17 },
      { startLineNumber: 19, endLineNumber: 26 },
    ],
  },
  {
    id: "optional-cancellation-reason",
    title: "cancel がキャンセル理由なしの呼び出しを受け入れている",
    currentDesign: "cancel の reason が CancellationReason | undefined で、理由がなければ実行時に throw します。",
    futureRisk: "理由を渡さない呼び出しもコンパイルが通り、キャンセル理由の欠落は実行して初めて判明します。",
    path: "src/domain/appointment/transitions.ts",
    highlights: [{ startLineNumber: 51, endLineNumber: 59 }],
  },
] as const) satisfies readonly CodeGuide[];

export const workspace = ({
  slug: session.slug,
  snapshot: session.snapshot,
  initialFile: "exercises/state-modeling.test.ts",
  description: "演習の要件と作成対象を、開始スナップショットで確認します。",
  visibleFiles: [
    "exercises/state-modeling.test.ts",
    "test/transitions.test.ts",
    "test/setup.test.ts",
    "src/domain/appointment/appointment.ts",
    "src/domain/appointment/transitions.ts",
  ],
} as const) satisfies SessionWorkspace;

export const promisesHref =
  "/sessions/01-state-transitions/peer-review/#peer-review-promises";

export const navigation = ({
  previous: {
    href: "/sessions/00-system-handover/",
    title: "業務とシステムを引き継ぐ",
  },
  next: {
    href: "/sessions/02-adt-and-exhaustiveness/",
    title: "予約の状態の分岐漏れを型で検出する",
  },
} as const);

export const javaStateCode = `sealed interface Appointment
    permits CheckedIn, InExamination {}

record CheckedIn(String id) implements Appointment {}

record InExamination(String id, String vetId)
    implements Appointment {}

static InExamination startExamination(
    CheckedIn c, String vetId) {
  return new InExamination(c.id(), vetId);
}`;

export const rustStateCode = `struct CheckedIn { id: String }

struct InExamination { id: String, vet_id: String }

enum Appointment {
    CheckedIn(CheckedIn),
    InExamination(InExamination),
}

fn start_examination(c: CheckedIn, vet_id: String)
    -> InExamination {
    InExamination { id: c.id, vet_id }
}`;
