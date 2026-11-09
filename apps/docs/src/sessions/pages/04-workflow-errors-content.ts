import type { CodeGuide } from "../../code-explorer/code-guide";
import type { SessionWorkspace } from "../../code-explorer/types";
import { quote } from "../reference-quote";
import type { SessionSummary } from "../types";
import startBeforeErrorsSource from "../../../../../examples/session-04/src/useCase/errors.ts?raw";
import solutionErrorsSource from "../../../../../examples/session-04-solution/src/useCase/errors.ts?raw";
import solutionRoutesSource from "../../../../../examples/session-04-solution/src/web/routes.ts?raw";

export const session: SessionSummary = {
  slug: "04-workflow-errors",
  snapshot: "session-04",
  sequence: "04",
  kind: "exercise",
  title: "失敗をユースケースの結果として扱う",
  durationMinutes: 31,
  timeBreakdown: { brief: 3, teach: 12, exercise: 10, review: 6 },
  adv: { articulate: 2, delegate: 5, verify: 3 },
  peerReview: {
    minutes: 6,
    pickCount: 2,
    questions: [
      "予約なしと状態不正は、異なる `kind` を持つ `Err` になっていますか。",
      "`andThen` は、失敗後の状態遷移と保存を実行しない構造になっていますか。",
      "Web側は業務エラーを `kind` で網羅し、未対応の種類を型エラーにできますか。",
    ],
  },
  solutionSnapshot: "session-04-solution",
  solutionPresentation: "excerpt",
  peerReviewPromises: "reference",
  animal: { name: "HAMSTER", type: "hamster", avatar: "🐹" },
  summary: "診察開始の失敗のうち、理由によって顧客や現場の対応が変わるものを、呼び出し側が扱える値として返します。",
  episode: [
    "別の端末で、同僚の獣医師がハムスターの診察を先に開始していました。",
    "古い画面にはまだ診察開始のボタンが残っていて、獣医師はそのボタンを押しました。",
    "画面には500とだけ表示され、後ろでは犬が吠え、列だけが伸びていきます。",
  ],
  incident: "状態不正の失敗が、Web側のcatchで処理されず、古い画面から診察開始を押した操作だけ500になった。",
  exerciseCommand: "pnpm exercise:04",
  exerciseModule: {
    dir: "examples/session-04/src",
    fileBudget: 3,
    lineBudget: 80,
  },
  delegationPrompt: {
    decisions: [
      "どの失敗に対して顧客や現場が別の操作を選ぶか",
      "呼び出し側が分岐に使う安定した情報は何か",
      "失敗後に実行してはいけない処理は何か",
      "要求された処理を完了できず、Resultへ変換せず外側へ伝えるシステムエラーは何か",
    ],
  },
  steps: [
    {
      id: "s04-invalid-state",
      goal: "来院済みでない状態を型付きの失敗として返す。",
      startingFailure: "来院済みでない予約を、例外として処理している。",
      targets: ["examples/session-04/src/useCase/errors.ts"],
      solutions: [{
        path: "examples/session-04-solution/src/useCase/errors.ts",
        symbol: "ensureCheckedIn",
        lines: [1, 31],
        placement: "examples/session-04/src/useCase/errors.ts の全体を、このコードに置き換えます。",
      }],
    },
    {
      id: "s04-not-found",
      goal: "予約が見つからない失敗を型付きの値として返す。",
      startingFailure: "予約が見つからない場合も、例外として処理している。",
      targets: ["examples/session-04/src/useCase/errors.ts"],
      solutions: [{
        path: "examples/session-04-solution/src/useCase/errors.ts",
        symbol: "ensureAppointmentFound",
        lines: [1, 31],
        placement: "examples/session-04/src/useCase/errors.ts の全体を、このコードに置き換えます。",
      }],
    },
    {
      id: "s04-result-pipeline",
      goal: "失敗理由をandThenで運び、失敗後の遷移と保存を実行しない。",
      startingFailure: "ユースケースが失敗理由をResultで運ばず、型から後続処理の条件を読めない。",
      targets: ["examples/session-04/src/useCase/startExamination.ts"],
      solutions: [{
        path: "examples/session-04-solution/src/useCase/startExamination.ts",
        symbol: "startExamination",
        lines: [7, 44],
        placement: "examples/session-04/src/useCase/startExamination.ts の全体を、このコードに置き換えます。",
      }],
    },
    {
      id: "s04-exhaustive-web-handler",
      goal: "Web側で業務エラーのkindを網羅し、それぞれ専用noticeへ変換する。",
      startingFailure: "状態不正の例外をWeb側が処理せず、500エラーにする。",
      targets: ["examples/session-04/src/web/routes.ts"],
      solutions: [
        {
          path: "examples/session-04-solution/src/web/routes.ts",
          symbol: "toStartExaminationNoticeCode",
          lines: [22, 48],
          placement: "examples/session-04/src/web/routes.ts の import 群の直後に、このコードを足します。",
        },
        {
          path: "examples/session-04/src/web/routes.ts",
          sourcePath: "apps/docs/src/sessions/solutions/session-04-start-examination-handler.ts.txt",
          symbol: "registerClinicRoutes",
          lines: [1, 22],
          placement: "examples/session-04/src/web/routes.ts の start-examination の app.post 全体を、このコードに置き換えます。",
        },
      ],
    },
  ],
  decisions: [
    {
      invariant: "顧客や現場が失敗理由に応じて操作を選ぶ必要がある失敗は、戻り値に現れる。",
    },
    {
      invariant: "呼び出し側は文言ではなく失敗のkindで分岐する。",
    },
    {
      invariant: "失敗経路では後続の処理を行わない。",
    },
  ],
  finalReferences: [
    "examples/final/src/useCase/errors.ts",
    "examples/final/src/useCase/startExaminationUseCase.ts",
    "examples/final/src/adaptor/primary/web/routes/appointmentRoutes.ts",
    "examples/final/src/adaptor/primary/web/middleware/useCaseResponse.ts",
  ],
};

export const guides = ([
  {
    id: "throws-known-errors",
    title: "起こりうる業務エラーが戻り値の型に現れない",
    currentDesign: "確認の関数（ensure...）は成功値だけを返す型ですが、予約なしと状態不正では Error を throw します。",
    futureRisk: "呼び出し側は実装を読まないと、どの例外を処理すべきか判断できません。",
    path: "src/useCase/errors.ts",
    highlights: [{ startLineNumber: 4, endLineNumber: 23 }],
  },
  {
    id: "catch-misses-state-error",
    title: "Web側が予約なしだけを文言でcatchしている",
    currentDesign: "例外メッセージにwas not foundが含まれる場合だけ、画面のお知らせへ変換し、それ以外は500になります。",
    futureRisk: "例外の種類を追加しても呼び出し側に型エラーが出ず、状態不正の例外のような処理漏れが残ります。",
    path: "src/web/routes.ts",
    highlights: [{ startLineNumber: 76, endLineNumber: 94 }],
  },
] as const) satisfies readonly CodeGuide[];

export const workspace = ({
  slug: session.slug,
  snapshot: session.snapshot,
  initialFile: "exercises/result-errors.test.ts",
  description: "例外の種類が型に現れず、Web側にcatch漏れがある開始スナップショットを確認します。",
  visibleFiles: [
    "exercises/result-errors.test.ts",
    "test/regression/boundary-and-ids.test.ts",
    "test/regression/state-modeling.test.ts",
    "src/boundary/examResult.ts",
    "src/boundary/ownerContact.ts",
    "src/domain/appointment/appointment.ts",
    "src/domain/appointment/transitions.ts",
    "src/domain/appointment/statusLabel.ts",
    "src/domain/appointment/appointmentId.ts",
    "src/domain/examResult/examId.ts",
    "src/domain/owner/ownerId.ts",
    "src/domain/pet/petId.ts",
    "src/domain/appointment/veterinarianId.ts",
    "src/shared/sensitive.ts",
    "src/useCase/errors.ts",
    "src/useCase/startExamination.ts",
    "src/web/routes.ts",
  ],
} as const) satisfies SessionWorkspace;

export const promisesHref =
  "/sessions/01-state-transitions/peer-review/#peer-review-promises";

export const navigation = ({
  previous: {
    href: "/sessions/03-boundaries-and-pii/",
    title: "診察開始の入力を境界で検証する",
  },
  next: {
    href: "/sessions/05-business-events-and-workflows/",
    title: "データとパイプラインで予約キャンセルを設計する",
  },
} as const);

type CodeQuote = Readonly<{ path: string; code: string }>;

const joinQuotes = (...parts: readonly string[]): string => parts.join("\n\n");

export const resultCode: Readonly<{ before: CodeQuote; after: CodeQuote }> = {
  before: {
    path: "examples/session-04/src/useCase/errors.ts",
    code: quote(startBeforeErrorsSource, 4, 13, "export const ensureAppointmentFound"),
  },
  after: {
    path: "examples/session-04-solution/src/useCase/errors.ts",
    code: joinQuotes(
      quote(solutionErrorsSource, 1, 1, 'import { err, ok, type Result } from "neverthrow"'),
      quote(solutionErrorsSource, 18, 24, "export const ensureAppointmentFound"),
    ),
  },
};

export const typedErrorsCode: CodeQuote = {
  path: "examples/session-04-solution/src/useCase/errors.ts",
  code: joinQuotes(
    quote(solutionErrorsSource, 6, 16, "export type AppointmentNotFound"),
    quote(solutionErrorsSource, 26, 31, "export const ensureCheckedIn"),
  ),
};

export const exhaustiveErrorsCode: CodeQuote = {
  path: "examples/session-04-solution/src/web/routes.ts",
  code: quote(solutionRoutesSource, 33, 48, "const assertNever"),
};

export const safeTryCode = `import { ok, safeTry, type Result } from "neverthrow";

export const startExamination =
  (deps: Dependencies) =>
  (input: StartExaminationInput): Result<InExamination, StartExaminationError> =>
    safeTry(function* () {
      const found = yield* ensureAppointmentFound(
        deps.resolver.resolveById(input.appointmentId),
        input.appointmentId,
      );
      const checkedIn = yield* ensureCheckedIn(found);
      const next = transitionToInExamination(
        checkedIn,
        input.veterinarianId,
        input.examinationStartedAt,
      );
      deps.store.save(next);
      return ok(next);
    });`;
