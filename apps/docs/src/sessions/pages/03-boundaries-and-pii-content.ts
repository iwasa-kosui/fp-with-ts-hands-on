import type { CodeGuide } from "../../code-explorer/code-guide";
import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import type { SessionWorkspace } from "../../code-explorer/types";
import { miniTree } from "../../components/mini-tree/mini-tree";
import { loadSolutionSnippets } from "../solution-snippets";
import { lineLabelOf, pathLabelOf, sourceOf } from "../source-quotes";
import type {
  DelegationPrompt,
  ExampleSnapshot,
  ExerciseModule,
  ExerciseStep,
  SessionSummary,
  SolutionPresentation,
} from "../types";

type SupplementaryExercise = Readonly<{
  exerciseCommand: string;
  exerciseModule: ExerciseModule;
  solutionSnapshot: ExampleSnapshot;
  solutionPresentation: SolutionPresentation;
  incident: string;
  delegationPrompt: DelegationPrompt;
  steps: readonly ExerciseStep[];
}>;

export const session: SessionSummary = {
  slug: "03-boundaries-and-pii",
  snapshot: "session-03",
  sequence: "03",
  kind: "exercise",
  title: "診察開始の入力を境界で検証する",
  durationMinutes: 35,
  timeBreakdown: { brief: 2, teach: 13, exercise: 15, review: 5 },
  adv: { articulate: 2, delegate: 11, verify: 2 },
  peerReview: {
    minutes: 5,
    pickCount: 2,
    questions: [
      "不正な予約IDまたは獣医師IDを含む入力は、`StartExaminationInput` になりませんか。",
      "`parse` は外部入力を `unknown` として受け取っていますか。",
      "検証に成功した場合だけ、`AppointmentId` と `VeterinarianId` をユースケースへ渡せますか。",
    ],
  },
  solutionSnapshot: "session-03-solution",
  solutionPresentation: "excerpt",
  peerReviewPromises: "reference",
  animal: { name: "BIRD", type: "bird", avatar: "🐦" },
  summary: "値の制約を型で表す書き方を学び、HTTPで受け取る予約IDと担当獣医師IDを検査して、型付きの診察開始入力へ変換します。",
  episode: [
    "15時30分、獣医師が診察開始画面で、「診察を開始する」ボタンを押しました。",
    "フロントエンドの送信処理は、獣医師のUUIDではなく画面表示用の勤務区分「night-shift」をveterinarianIdへ格納しました。",
    "境界のparseは値を検査せずOkを返し、不正な値からStartExaminationInputを作りました。",
  ],
  incident: "HTTPで受け取った不正なIDを検査せず、診察開始の入力として扱った。",
  exerciseCommand: "pnpm exercise:03",
  exerciseModule: {
    dir: "examples/session-03/src/adaptor/primary/web",
    fileBudget: 1,
    lineBudget: 18,
  },
  delegationPrompt: {
    decisions: [
      "外部入力をunknownとして受け取る場所はどこか",
      "AppointmentIdとVeterinarianIdのschemaをどう組み合わせるか",
    ],
  },
  steps: [
    {
      id: "s03-reject-invalid-appointment-id",
      goal: "不正な予約IDを含むHTTP入力は、StartExaminationInputにならないようにする。",
      startingFailure: "不正な予約IDでも、診察開始の入力として扱える。",
      targets: ["examples/session-03/src/adaptor/primary/web/startExaminationInput.ts"],
      solutions: [{
        path: "examples/session-03-solution/src/adaptor/primary/web/startExaminationInput.ts",
        symbol: "StartExaminationInput",
        lines: [6, 18],
      }],
    },
    {
      id: "s03-reject-invalid-veterinarian-id",
      goal: "不正な担当獣医師IDを含むHTTP入力は、StartExaminationInputにならないようにする。",
      startingFailure: "不正な担当獣医師IDでも、診察開始の入力として扱える。",
      targets: ["examples/session-03/src/adaptor/primary/web/startExaminationInput.ts"],
      solutions: [{
        path: "examples/session-03-solution/src/adaptor/primary/web/startExaminationInput.ts",
        symbol: "StartExaminationInput",
        lines: [6, 18],
      }],
    },
  ],
  decisions: [
    {
      invariant: "外部入力はunknownとして受け取り、境界で検証してから型付き入力になる。",
    },
    {
      invariant: "予約IDと担当獣医師IDの両方が正しい場合だけ、startExaminationへ渡す。",
    },
  ],
  finalReferences: [
    "examples/final/src/domain/shared/schemaResult.ts",
    "examples/final/src/domain/appointment/appointmentId.ts",
    "examples/final/src/domain/appointment/veterinarianId.ts",
    "examples/final/src/useCase/startExaminationUseCase.ts",
    "examples/final/src/domain/appointment/paymentAmount.ts",
  ],
};

export const supplementaryExercise: SupplementaryExercise = {
  exerciseCommand: "pnpm exercise:03-supplement",
  exerciseModule: {
    dir: "examples/session-03-supplement/src/domain",
    fileBudget: 5,
    lineBudget: 34,
  },
  solutionSnapshot: "session-03-supplement-solution",
  solutionPresentation: "excerpt",
  incident: "診察開始で AppointmentId と VeterinarianId を取り違えても、型検査が通った。",
  delegationPrompt: {
    decisions: [
      "AppointmentIdとVeterinarianIdをどの型として定義するか",
      "用途の区別を予約状態とstartExaminationへどう伝えるか",
      "取り違えをコンパイルエラーとしてどう残すか",
    ],
  },
  steps: [
    {
      id: "s03-brand-start-examination-ids",
      goal: "予約IDと担当獣医師IDを、配布済みの識別子と同じ規約で別々の型にする。",
      startingFailure: "予約IDと担当獣医師IDを取り違えても、型検査が通る。",
      targets: [
        "examples/session-03-supplement/src/domain/appointment/appointmentId.ts",
        "examples/session-03-supplement/src/domain/appointment/veterinarianId.ts",
      ],
      solutions: [
        {
          path: "examples/session-03-supplement-solution/src/domain/appointment/appointmentId.ts",
          symbol: "AppointmentId",
          lines: [3, 6],
        },
        {
          path: "examples/session-03-supplement-solution/src/domain/appointment/veterinarianId.ts",
          symbol: "VeterinarianId",
          lines: [3, 6],
        },
      ],
    },
    {
      id: "s03-apply-start-examination-ids",
      goal: "予約の6状態とstartExaminationが、用途別の識別子を受け取るようにする。",
      startingFailure: "予約状態とstartExaminationが、用途を区別しないstringを受け取る。",
      targets: [
        "examples/session-03-supplement/src/domain/appointment/appointment.ts",
        "examples/session-03-supplement/src/domain/appointment/transitions.ts",
      ],
      solutions: [
        {
          path: "examples/session-03-supplement-solution/src/domain/appointment/appointment.ts",
          symbol: "Scheduled",
          lines: [1, 15],
        },
        {
          path: "examples/session-03-supplement-solution/src/domain/appointment/transitions.ts",
          symbol: "startExamination",
          lines: [17, 27],
        },
      ],
    },
    {
      id: "s03-reject-id-swap",
      goal: "AppointmentIdとVeterinarianIdを入れ替えたコードが型検査のときに型エラーとして報告されることを、型テストで検証する。",
      startingFailure: "取り違えた2行が、型エラーにならないままコンパイルされる。",
      targets: ["examples/session-03-supplement/src/domain/domain.test-types.ts"],
      solutions: [{
        path: "examples/session-03-supplement-solution/src/domain/domain.test-types.ts",
        symbol: "acceptAppointmentId",
        lines: [1, 14],
      }],
    },
  ],
};

export const guides = ([
  {
    id: "http-start-examination-input",
    title: "診察開始のHTTP入力はrouteで組み立てている",
    currentDesign: "routeは、予約IDとbodyのveterinarianIdを1つのobjectにまとめてparseへ渡します。",
    futureRisk: "bodyにnight-shiftが入っていても、ここでは何も検証しません。",
    path: "src/adaptor/primary/web/routes.ts",
    highlights: [{ startLineNumber: 109, endLineNumber: 115 }],
  },
  {
    id: "unvalidated-start-examination-input",
    title: "HTTP入力をanyのまま診察開始の入力へ渡している",
    currentDesign: "parseはraw: anyから2項目をコピーし、検査せずに必ずokを返します。",
    futureRisk: "rawがanyであるためraw.veterinarianIdもanyです。night-shiftは検証されずにVeterinarianId型の項目へ格納されます。",
    path: "src/adaptor/primary/web/startExaminationInput.ts",
    highlights: [{ startLineNumber: 1, endLineNumber: 15 }],
  },
] as const) satisfies readonly CodeGuide[];

const guideTree = miniTree("session-03", "src/", [
  {
    folder: "adaptor/primary/web/",
    files: [
      { id: "route", name: "routes.ts" },
      { id: "input", name: "startExaminationInput.ts" },
    ],
  },
]);

export const guideTrees = {
  "http-start-examination-input": { tree: guideTree, current: ["route"] },
  "unvalidated-start-examination-input": { tree: guideTree, current: ["input"] },
} as const;

export const paymentAmountQuote = ({
  source: pathLabelOf("final", "src/domain/appointment/paymentAmount.ts"),
  code: sourceOf(
    projectFilesForSnapshot("final"),
    "src/domain/appointment/paymentAmount.ts",
  ),
} as const);

export const workspace = ({
  slug: session.slug,
  snapshot: session.snapshot,
  initialFile: "exercises/start-examination-input.test.ts",
  description: "HTTP入力を診察開始の型付き入力へ変換する境界を確認します。",
  visibleFiles: [
    "exercises/start-examination-input.test.ts",
    "test/regression/semantic-identifiers.test.ts",
    "test/regression/state-modeling.test.ts",
    "src/domain/appointment/appointmentId.ts",
    "src/domain/appointment/veterinarianId.ts",
    "src/adaptor/primary/web/startExaminationInput.ts",
    "src/domain/shared/schemaResult.ts",
    "src/adaptor/primary/web/routes.ts",
  ],
} as const) satisfies SessionWorkspace;

export const promisesHref =
  "/sessions/01-state-transitions/peer-review/#peer-review-promises";

export const navigation = ({
  previous: {
    href: "/sessions/02-adt-and-exhaustiveness/",
    title: "予約の状態の分岐漏れを型で検出する",
  },
  next: {
    href: "/sessions/04-workflow-errors/",
    title: "失敗をユースケースの結果として扱う",
  },
} as const);

export const projectFiles = projectFilesForSnapshot(session.snapshot);

export const incidentRequest = `POST /appointments/11111111-1111-4111-8111-111111111111/start-examination
Content-Type: application/json

{
  "veterinarianId": "night-shift"
}`;

const brandedIdSnippets = await loadSolutionSnippets({
  solutions: [
    {
      path: "examples/session-03-supplement/src/domain/appointment/appointmentId.ts",
      symbol: "AppointmentId",
      lines: [1, 6],
    },
    {
      path: "examples/session-03-supplement-solution/src/domain/appointment/appointmentId.ts",
      symbol: "AppointmentId",
      lines: [1, 6],
    },
    {
      path: "examples/session-03-supplement/src/domain/domain.test-types.ts",
      symbol: "acceptVeterinarianId",
      lines: [6, 10],
    },
    {
      path: "examples/session-03-supplement-solution/src/domain/domain.test-types.ts",
      symbol: "acceptVeterinarianId",
      lines: [6, 13],
    },
    {
      path: "examples/session-03-supplement-solution/src/domain/domain.test-types.ts",
      symbol: "AppointmentId.parse",
      lines: [1, 5],
    },
  ],
});
const [brandedBeforeId, brandedAfterId, brandedBeforeSwap, brandedAfterSwap, brandedAfterParse] =
  brandedIdSnippets.map(({ solution, code }) => ({ path: solution.path, code }));

export const brandedIdCode = {
  beforeId: brandedBeforeId,
  afterId: brandedAfterId,
  beforeSwap: brandedBeforeSwap,
  afterSwap: brandedAfterSwap,
  afterParse: brandedAfterParse,
};

const schemaSourceSnippets = await loadSolutionSnippets({
  solutions: [
    {
      path: "examples/session-03/src/adaptor/primary/web/startExaminationInput.ts",
      symbol: "StartExaminationInput",
      lines: [1, 16],
    },
    {
      path: "examples/session-03-solution/src/adaptor/primary/web/startExaminationInput.ts",
      symbol: "StartExaminationInput",
      lines: [1, 17],
    },
    {
      path: "examples/session-03-solution/src/domain/shared/schemaResult.ts",
      symbol: "schemaResult",
      lines: [23, 27],
    },
  ],
});
const [schemaBeforeSnippet, schemaAfterSnippet, schemaResultSnippet] = schemaSourceSnippets;
const startExaminationInputPath = "src/adaptor/primary/web/startExaminationInput.ts";
const schemaBefore = {
  path: pathLabelOf("session-03", startExaminationInputPath),
  code: schemaBeforeSnippet.code,
};
const schemaAfter = {
  path: pathLabelOf("session-03-solution", startExaminationInputPath),
  code: schemaAfterSnippet.code,
};
const schemaResultSource = {
  path: lineLabelOf(
    "session-03-solution",
    "src/domain/shared/schemaResult.ts",
    "export const schemaResult = <T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>",
    "  };",
  ),
  code: schemaResultSnippet.code,
};

export const schemaSourceCode = {
  before: schemaBefore,
  after: schemaAfter,
  schemaResult: schemaResultSource,
};
