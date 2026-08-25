export type SessionKind = "orientation" | "workshop" | "exercise" | "reference";

export type SolutionPresentation = "excerpt" | "completed-file";

export type WorkflowFocus =
  | "現状"
  | "ドメインイベント"
  | "current state"
  | "値の意味"
  | "input"
  | "expected failures"
  | "output event/side effects"
  | "境界確認";

export type WorkflowRisks = Readonly<{
  resolvedFromPrevious: string;
  remainingForNext: string;
}>;

export type ExerciseModule = Readonly<{
  dir: string;
  fileBudget: number;
  lineBudget: number;
}>;

export type ExerciseStep = Readonly<{
  id: string;
  goal: string;
  targets: readonly string[];
  solutions: readonly [SolutionReference, ...SolutionReference[]];
}>;

export type SolutionReference = Readonly<{
  path: string;
  symbol: string;
  lines: readonly [number, number];
  presentation?: SolutionPresentation;
}>;

export type Decision = Readonly<{
  invariant: string;
  byType: string;
  notByType: string;
}>;

export type AdvBreakdown = Readonly<{
  articulate: number;
  delegate: number;
  verify: number;
}>;

export type TimeBreakdown = Readonly<{
  brief: number;
  teach: number;
  exercise: number;
  review: number;
}>;

export type PeerReview = Readonly<{
  minutes: number;
  pickCount: 1 | 2;
  questions: readonly string[];
}>;

type SessionSummaryBase = Readonly<{
  slug: string;
  sequence: "00" | "01" | "02" | "03" | "04" | "05" | "06" | "Final";
  title: string;
  durationMinutes: number;
  timeBreakdown: TimeBreakdown;
  workflowFocus: WorkflowFocus;
  workflowRisks: WorkflowRisks;
  adv?: AdvBreakdown;
  peerReview?: PeerReview;
  animal: Readonly<{ name: string; type: string; avatar: string }>;
  summary: string;
  incident: string;
  exerciseCommand?: string;
  exerciseModule?: ExerciseModule;
  solutionSnapshot?: ExampleSnapshot;
  solutionPresentation?: SolutionPresentation;
  peerReviewPromises?: "inline" | "reference";
  steps: readonly ExerciseStep[];
  decisions: readonly Decision[];
  finalReferences: readonly string[];
}>;

export type ExerciseSessionSummary = SessionSummaryBase & Readonly<{
  kind: "exercise";
  snapshot: PublicCodeExplorerSnapshot;
  adv: AdvBreakdown;
  peerReview: PeerReview;
  exerciseCommand: string;
  exerciseModule: ExerciseModule;
  solutionSnapshot: ExampleSnapshot;
  solutionPresentation: SolutionPresentation;
  peerReviewPromises: "inline" | "reference";
}>;

type NonExerciseMetadata = Readonly<{
  adv?: never;
  peerReview?: never;
  exerciseCommand?: never;
  exerciseModule?: never;
  solutionSnapshot?: never;
  solutionPresentation?: never;
  peerReviewPromises?: never;
}>;

type SnapshotSessionSummary = SessionSummaryBase &
  NonExerciseMetadata &
  Readonly<{
    kind: "orientation" | "reference";
    snapshot: PublicCodeExplorerSnapshot;
  }>;

type WorkshopSessionSummary = SessionSummaryBase &
  NonExerciseMetadata &
  Readonly<{
    kind: "workshop";
    snapshot?: never;
  }>;

export type SessionSummary =
  | ExerciseSessionSummary
  | SnapshotSessionSummary
  | WorkshopSessionSummary;

export type ExampleSnapshot =
  | "session-00"
  | "session-01"
  | "session-02"
  | "session-03"
  | "session-04"
  | "session-05"
  | "session-06"
  | "session-07"
  | "final";

export type PublicCodeExplorerSnapshot = Exclude<
  ExampleSnapshot,
  "session-01" | "session-07"
>;

export const peerReviewQuestions = [
  "この差分では、不変条件を型で守っていますか。それとも実行時の `if` で守っていますか。該当する行を1行、画面上で示してください。",
  "この状態を壊すコードを1行書くとしたら、どう書きますか。それはコンパイルを通りますか。",
  "自分の差分と違うところを1つ挙げてください。どちらが良いかは言わなくてよいです。",
] as const;

export const peerReviewPromises = [
  "見るのは差分であって人ではありません。発言は「この差分は」で始めます。",
  "良し悪しを判定しません。",
  "5回のレビューで、班員全員が少なくとも1回は選ばれるよう公平に配分します。選ばれることは評価ではありません。",
  "本人は弁明しません。読み上げるのは依頼文の1文だけです。",
  "TAは「よくできた実装」を選びません。選定基準を参加者にも開示します。",
] as const;

export const reviewDiffStatCommand = (snapshot: ExampleSnapshot): string =>
  `git diff --stat -- examples/${snapshot}`;

export const reviewStatusCommand = "git status --short";

export const commonReviewChecksFor = (
  snapshot: ExampleSnapshot,
): readonly [string, string, string, string] => [
  "`as` によるキャストが入っていないか全文検索して確認する。",
  `\`${reviewDiffStatCommand(snapshot)}\` で今回の snapshot だけを確認し、\`${reviewStatusCommand}\` でリポジトリ全体の想定外の path を確認する。`,
  "不変条件を型で守っているか、実行時の `if` で守っているか判定する。",
  "相互レビューの末尾1分で、型で守れなかった残りを記録する。",
];

export const reviewCompletionArtifacts = [
  "守る不変条件の1文",
  "依頼文",
  "型で守れなかった残り",
] as const;

export const businessReflectionQuestion =
  "自分の業務コードで、今回と同種の問題が起きうる箇所はどこですか。";

export const finalAggregateTour = {
  label: "1業務集約 → 7業務集約",
  path: "examples/final/src/app.ts",
  aggregates: [
    "予約",
    "検査結果",
    "フォローアップ",
    "飼い主",
    "ペット",
    "セッション",
    "ユーザー",
  ],
} as const;

export const sessions = [
  {
    slug: "00-system-handover",
    snapshot: "session-00",
    sequence: "00",
    kind: "orientation",
    title: "業務とシステムを引き継ぐ",
    durationMinutes: 10,
    timeBreakdown: { brief: 4, teach: 3, exercise: 0, review: 3 },
    workflowFocus: "現状",
    workflowRisks: {
      resolvedFromPrevious: "引き継いだ業務・操作・保存先・ログと、現在起きている事故を対応付けた。",
      remainingForNext: "診察開始を一つの業務ワークフローとして定義し、設計対象の全体像を描く。",
    },
    animal: { name: "DOG", type: "dog", avatar: "🐕" },
    summary: "WAN NYAN CLINIC の現行業務、画面操作、保存・ログと、現在起きている事故を確認します。",
    incident: "会計済みの予約が診察中へ戻り、予約ログから飼い主の個人情報が流出した。",
    steps: [],
    decisions: [],
    finalReferences: [],
  },
  {
    slug: "01-business-events-and-workflows",
    snapshot: undefined,
    sequence: "01",
    kind: "workshop",
    title: "ビジネスイベントからワークフローを描く",
    durationMinutes: 15,
    timeBreakdown: { brief: 3, teach: 4, exercise: 6, review: 2 },
    workflowFocus: "ドメインイベント",
    workflowRisks: {
      resolvedFromPrevious: "来院から会計までの業務をドメインイベントとして拾い、時系列に並べて、集約ごとの境界を班で引いた。",
      remainingForNext: "予約集約の中で、予約がどの状態なら診察を開始できるかをまだ決めていない。",
    },
    animal: { name: "CAT", type: "cat", avatar: "🐈" },
    summary: "動物病院の一日を描いた散文からドメインイベントを拾い、集約の境界を班で引きます。",
    incident: "業務全体のどこからどこまでが診察開始のワークフローなのか、担当者ごとに認識が揃っていない。",
    steps: [],
    decisions: [],
    finalReferences: [],
  },
  {
    slug: "02-state-transitions",
    snapshot: "session-02",
    sequence: "02",
    kind: "exercise",
    title: "予約の状態と遷移をモデル化する",
    durationMinutes: 30,
    timeBreakdown: { brief: 4, teach: 6, exercise: 13, review: 7 },
    workflowFocus: "current state",
    workflowRisks: {
      resolvedFromPrevious: "許可されない状態遷移と、状態ごとに欠けた情報を型で防いだ。",
      remainingForNext: "外部から届く値、失敗の表現、保存の整合性をまだ扱う必要がある。",
    },
    adv: { articulate: 2, delegate: 9, verify: 2 },
    peerReview: { minutes: 7, pickCount: 2, questions: peerReviewQuestions },
    solutionSnapshot: "session-03",
    solutionPresentation: "excerpt",
    peerReviewPromises: "inline",
    animal: { name: "RABBIT", type: "rabbit", avatar: "🐇" },
    summary: "予約の5状態と許可された遷移を型へ移し、終端状態からの逆行を防ぎます。",
    incident: "会計済みの来院が診察中へ戻され、会計が二度行われた。",
    exerciseCommand: "pnpm exercise:02",
    exerciseModule: {
      dir: "examples/session-02/src/domain/appointment",
      fileBudget: 2,
      lineBudget: 35,
    },
    steps: [
      {
        id: "s2-narrow-start",
        goal: "会計済み・キャンセル済みの来院は診察を開始できないようにする。",
        targets: ["examples/session-02/src/domain/appointment/transitions.ts"],
        solutions: [{
          path: "examples/session-03/src/domain/appointment/transitions.ts",
          symbol: "startExamination",
          lines: [14, 24],
        }],
      },
      {
        id: "s2-require-cancel-reason",
        goal: "キャンセルには必ず理由を残す。",
        targets: ["examples/session-02/src/domain/appointment/transitions.ts"],
        solutions: [{
          path: "examples/session-03/src/domain/appointment/transitions.ts",
          symbol: "cancel",
          lines: [33, 46],
        }],
      },
      {
        id: "s2-align-transitions",
        goal: "残りの遷移も、許可された遷移元だけを受け取る規約にそろえる。",
        targets: ["examples/session-02/src/domain/appointment/transitions.ts"],
        solutions: [{
          path: "examples/session-03/src/domain/appointment/transitions.ts",
          symbol: "checkIn",
          lines: [11, 31],
        }],
      },
      {
        id: "s2-exhaustive-label",
        goal: "状態を追加したら表示名の分岐をコンパイルエラーにする。",
        targets: ["examples/session-02/src/domain/appointment/statusLabel.ts"],
        solutions: [{
          path: "examples/session-03/src/domain/appointment/statusLabel.ts",
          symbol: "toStatusLabel",
          lines: [3, 22],
        }],
      },
    ],
    decisions: [
      {
        invariant: "終端状態から以前の状態へ戻らない。",
        byType: "遷移元を関数の引数型で限定し、逆行遷移の関数を作らない。",
        notByType: "呼び出し側が型アサーションで状態を捏造することは型だけでは防げない。",
      },
      {
        invariant: "状態ごとの必須情報を欠かさない。",
        byType: "状態別の判別共用体と satisfies で戻り値を検査する。",
        notByType: "外部 JSON からの復元には、別途境界での検証が必要になる。",
      },
      {
        invariant: "状態を増やしたらすべての分岐を見直す。",
        byType: "assertNever で switch の網羅性を検査する。",
        notByType: "「不明」を返す default 分岐へ戻せば検査を回避できるため、レビューも必要になる。",
      },
    ],
    finalReferences: [
      "examples/final/src/domain/appointment/appointment.ts",
      "examples/final/src/domain/shared/assertNever.ts",
    ],
  },
  {
    slug: "03-semantic-identifiers",
    snapshot: "session-03",
    sequence: "03",
    kind: "exercise",
    title: "用途の異なる識別子を型で区別する",
    durationMinutes: 30,
    timeBreakdown: { brief: 4, teach: 6, exercise: 13, review: 7 },
    workflowFocus: "値の意味",
    workflowRisks: {
      resolvedFromPrevious: "同じ形式で表された識別子を用途ごとに別の型へ分け、取り違えをコンパイルで止めた。",
      remainingForNext: "外部から届く値の検証と、個人情報の守り方をまだ扱う必要がある。",
    },
    adv: { articulate: 2, delegate: 9, verify: 2 },
    peerReview: { minutes: 7, pickCount: 2, questions: peerReviewQuestions },
    solutionSnapshot: "session-04",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    animal: { name: "HEDGEHOG", type: "hedgehog", avatar: "🦔" },
    summary: "予約・検査・ペット・飼い主・担当獣医師の識別子を、用途ごとに区別して扱います。",
    incident: "検査結果の登録で OwnerId を PetId の位置へ渡し、対象のペットに結果を結び付けられなかった。",
    exerciseCommand: "pnpm exercise:03",
    exerciseModule: {
      dir: "examples/session-03/src/domain",
      fileBudget: 5,
      lineBudget: 34,
    },
    steps: [
      {
        id: "s3-brand-domain-ids",
        goal: "ペットと飼い主の識別子を、配布済みの ExamId と同じ規約で別々の型にする。",
        targets: [
          "examples/session-03/src/domain/ids/petId.ts",
          "examples/session-03/src/domain/ids/ownerId.ts",
        ],
        solutions: [
          {
            path: "examples/session-04/src/domain/ids/petId.ts",
            symbol: "PetId",
            lines: [3, 6],
          },
          {
            path: "examples/session-04/src/domain/ids/ownerId.ts",
            symbol: "OwnerId",
            lines: [3, 6],
          },
        ],
      },
      {
        id: "s3-apply-ids-to-appointment",
        goal: "予約の5状態と遷移が受け取る識別子を、用途別の型へ置き換える。",
        targets: [
          "examples/session-03/src/domain/appointment/appointment.ts",
          "examples/session-03/src/domain/appointment/transitions.ts",
        ],
        solutions: [
          {
            path: "examples/session-04/src/domain/appointment/appointment.ts",
            symbol: "Scheduled",
            lines: [1, 15],
          },
          {
            path: "examples/session-04/src/domain/appointment/transitions.ts",
            symbol: "startExamination",
            lines: [10, 25],
          },
        ],
      },
      {
        id: "s3-reject-id-swap",
        goal: "OwnerId を PetId の位置へ渡すコードがコンパイルできないことを、型テストで自分で確かめる。",
        targets: ["examples/session-03/src/domain/domain.test-types.ts"],
        solutions: [{
          path: "examples/session-04/src/domain/domain.test-types.ts",
          symbol: "acceptPetId",
          lines: [1, 15],
        }],
      },
    ],
    decisions: [
      {
        invariant: "用途の異なる識別子を取り違えない。",
        byType: "用途別のbranded typeで区別する。",
        notByType: "永続化上は同じTEXTなので復元時に再度parseする必要がある。",
      },
      {
        invariant: "予約はどの状態でも用途別の識別子を持つ。",
        byType: "5状態と遷移関数の引数で、同じ識別子の型を使う。",
        notByType: "同じ PetId 型の別のペットを選ぶ誤りは、型だけでは検出できない。",
      },
      {
        invariant: "取り違えたコードはコンパイルできない。",
        byType: "@ts-expect-errorの型テストで、通ってはいけない代入を検査する。",
        notByType: "型テストを書かなかった箇所が守られているかは分からない。",
      },
    ],
    finalReferences: [
      "examples/final/src/domain/appointment/appointmentId.ts",
      "examples/final/src/domain/pet/petId.ts",
      "examples/final/src/domain/owner/ownerId.ts",
    ],
  },
  {
    slug: "04-boundaries-and-pii",
    snapshot: "session-04",
    sequence: "04",
    kind: "exercise",
    title: "外部入力を境界で検証し個人情報を守る",
    durationMinutes: 30,
    timeBreakdown: { brief: 4, teach: 7, exercise: 12, review: 7 },
    workflowFocus: "input",
    workflowRisks: {
      resolvedFromPrevious: "外部入力を信頼境界で検証し、公開してよい情報とそうでない情報を区別した。",
      remainingForNext: "ワークフローの業務失敗と副作用の整合性をまだ扱う必要がある。",
    },
    adv: { articulate: 2, delegate: 8, verify: 2 },
    peerReview: { minutes: 7, pickCount: 2, questions: peerReviewQuestions },
    solutionSnapshot: "session-05",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    animal: { name: "BIRD", type: "bird", avatar: "🐦" },
    summary: "外部 JSON と飼い主の連絡先を、境界で安全な値へ変換します。",
    incident: "検査機関から届いた JSON をそのまま信頼し、調査用のログへ飼い主の連絡先が流出した。",
    exerciseCommand: "pnpm exercise:04",
    exerciseModule: {
      dir: "examples/session-04/src/boundary",
      fileBudget: 2,
      lineBudget: 26,
    },
    steps: [
      {
        id: "s4-parse-exam-result",
        goal: "形式が異なる検査結果の JSON は、ドメイン型にならないようにする。",
        targets: ["examples/session-04/src/boundary/examResult.ts"],
        solutions: [{
          path: "examples/session-05/src/boundary/examResult.ts",
          symbol: "ExamResult",
          lines: [7, 19],
        }],
      },
      {
        id: "s4-protect-contact",
        goal: "電話番号とメールは既定でログに出ないようにする。",
        targets: ["examples/session-04/src/boundary/ownerContact.ts"],
        solutions: [{
          path: "examples/session-05/src/boundary/ownerContact.ts",
          symbol: "OwnerContact",
          lines: [6, 19],
        }],
      },
    ],
    decisions: [
      {
        invariant: "外部入力は、境界で検証してからドメイン型になる。",
        byType: "unknownをschemaでparseし、Resultとして返す。",
        notByType: "境界を迂回してオブジェクトを直接作る経路は、運用上のルールで防ぐ必要がある。",
      },
      {
        invariant: "個人情報は既定でマスクし、値を取り出す場所を限定する。",
        byType: "Sensitiveで包み、unwrapの呼び出し箇所を明示する。",
        notByType: "unwrap後の文字列の扱いは型では守れない。",
      },
    ],
    finalReferences: [
      "examples/final/src/domain/shared/schemaResult.ts",
      "examples/final/src/domain/shared/sensitive.ts",
      "examples/final/src/domain/owner/ownerPhone.ts",
      "examples/final/src/domain/examResult/examResult.ts",
    ],
  },
  {
    slug: "05-workflow-errors",
    snapshot: "session-05",
    sequence: "05",
    kind: "exercise",
    title: "失敗をワークフローの結果として扱う",
    durationMinutes: 30,
    timeBreakdown: { brief: 4, teach: 3, exercise: 15, review: 8 },
    workflowFocus: "expected failures",
    workflowRisks: {
      resolvedFromPrevious: "予期できる業務上の失敗を戻り値に現し、成功経路だけを続けるようにした。",
      remainingForNext: "非決定値、永続化、監査記録、例外を扱う外側の境界が残っている。",
    },
    adv: { articulate: 2, delegate: 10, verify: 3 },
    peerReview: { minutes: 8, pickCount: 2, questions: peerReviewQuestions },
    solutionSnapshot: "session-06",
    solutionPresentation: "excerpt",
    peerReviewPromises: "reference",
    animal: { name: "HAMSTER", type: "hamster", avatar: "🐹" },
    summary: "診察開始の予期できる失敗を、呼び出し側が扱える値として返します。",
    incident: "例外メッセージの変更で画面の分岐が壊れ、受付が失敗理由を追えなくなった。",
    exerciseCommand: "pnpm exercise:05",
    exerciseModule: {
      dir: "examples/session-05/src/useCase",
      fileBudget: 3,
      lineBudget: 76,
    },
    steps: [
      {
        id: "s5-invalid-state",
        goal: "受付済みでない状態を型付きの失敗として返す。",
        targets: ["examples/session-05/src/useCase/errors.ts"],
        solutions: [{
          path: "examples/session-06/src/useCase/errors.ts",
          symbol: "ensureCheckedIn",
          lines: [31, 36],
        }],
      },
      {
        id: "s5-not-found",
        goal: "予約が見つからない失敗を型付きの値として返す。",
        targets: ["examples/session-05/src/useCase/errors.ts"],
        solutions: [{
          path: "examples/session-06/src/useCase/errors.ts",
          symbol: "ensureAppointmentFound",
          lines: [23, 29],
        }],
      },
      {
        id: "s5-result-pipeline",
        goal: "失敗理由をandThenのパイプラインで運ぶ。",
        targets: ["examples/session-05/src/useCase/startExamination.ts"],
        solutions: [{
          path: "examples/session-06/src/useCase/startExamination.ts",
          symbol: "startExamination",
          lines: [22, 40],
        }],
      },
    ],
    decisions: [
      {
        invariant: "予期できる失敗は戻り値に現れる。",
        byType: "Resultとkindを持つエラーの判別共用体で表す。",
        notByType: "どこまでを予期できる失敗とするかは人が決める必要がある。",
      },
      {
        invariant: "呼び出し側は文言ではなく失敗のkindで分岐する。",
        byType: "エラーunionと網羅的な分岐で表す。",
        notByType: "利用者向け文言や翻訳の正しさはレビュー対象になる。",
      },
      {
        invariant: "失敗経路では後続の処理を行わない。",
        byType: "ResultのandThenで成功経路だけを接続する。",
        notByType: "副作用が実際に呼ばれないことはフェイクportを使うテストで守る。",
      },
    ],
    finalReferences: [
      "examples/final/src/useCase/errors.ts",
      "examples/final/src/useCase/startExaminationUseCase.ts",
      "examples/final/src/adaptor/primary/web/middleware/useCaseResponse.ts",
    ],
  },
  {
    slug: "06-effects-and-consistency",
    snapshot: "session-06",
    sequence: "06",
    kind: "exercise",
    title: "副作用と整合性境界を設計する",
    durationMinutes: 30,
    timeBreakdown: { brief: 4, teach: 3, exercise: 15, review: 8 },
    workflowFocus: "output event/side effects",
    workflowRisks: {
      resolvedFromPrevious: "成功したワークフローの状態と監査を同じ整合性境界で保存し、保存障害を業務結果へ偽装しない形にした。",
      remainingForNext: "実運用で必要な永続化transactionと、次に着手する小さな改善候補が残っている。",
    },
    adv: { articulate: 2, delegate: 10, verify: 3 },
    peerReview: { minutes: 8, pickCount: 2, questions: peerReviewQuestions },
    solutionSnapshot: "session-07",
    solutionPresentation: "completed-file",
    peerReviewPromises: "reference",
    animal: { name: "TURTLE", type: "turtle", avatar: "🐢" },
    summary: "時刻や ID など実行のたびに変わる値と保存を port に切り出し、状態と監査記録を一度に保存します。",
    incident: "実行のたびに変わる値でテスト結果が安定せず、状態だけ保存され監査記録が残らない予約が生まれた。",
    exerciseCommand: "pnpm exercise:06",
    exerciseModule: {
      dir: "examples/session-06/src/useCase",
      fileBudget: 3,
      lineBudget: 55,
    },
    steps: [
      {
        id: "s6-inject-context",
        goal: "Clock と ID generator を使って EventContext を一度だけ生成する。",
        targets: [
          "examples/session-06/src/useCase/dependencies.ts",
          "examples/session-06/src/useCase/startExamination.ts",
        ],
        solutions: [
          {
            path: "examples/session-07/src/useCase/dependencies.ts",
            symbol: "EventContextDependencies",
            lines: [1, 43],
            presentation: "completed-file",
          },
          {
            path: "examples/session-07/src/useCase/startExamination.ts",
            symbol: "createEventContext",
            lines: [1, 81],
            presentation: "completed-file",
          },
        ],
      },
      {
        id: "s6-atomic-store",
        goal: "状態と監査記録を1回の保存で残す。",
        targets: ["examples/session-06/src/useCase/dependencies.ts"],
        solutions: [
          {
            path: "examples/session-07/src/useCase/dependencies.ts",
            symbol: "ExaminationStartedStore",
            lines: [1, 43],
            presentation: "completed-file",
          },
        ],
      },
      {
        id: "s6-result-async",
        goal: "非同期で保存しても、イベントを結果として返す。",
        targets: ["examples/session-06/src/useCase/startExamination.ts"],
        solutions: [{
          path: "examples/session-07/src/useCase/startExamination.ts",
          symbol: "startExaminationWithEffects",
          lines: [1, 81],
          presentation: "completed-file",
        }],
      },
      {
        id: "s6-propagate-store-failure",
        goal: "保存失敗を業務Resultへ変換せず、例外として外側の境界へ伝播する。",
        targets: [
          "examples/session-06/src/useCase/errors.ts",
          "examples/session-06/src/useCase/startExamination.ts",
        ],
        solutions: [
          {
            path: "examples/session-07/src/useCase/errors.ts",
            symbol: "AppointmentConflict",
            lines: [1, 39],
            presentation: "completed-file",
          },
          {
            path: "examples/session-07/src/useCase/startExamination.ts",
            symbol: "startExaminationWithEffects",
            lines: [1, 81],
            presentation: "completed-file",
          },
        ],
      },
    ],
    decisions: [
      {
        invariant: "時刻とイベント ID は1回のワークフロー実行で一度だけ生成し、同じ実行コンテキストから状態と監査記録を作る。",
        byType: "Clock と EventIdGenerator を1メソッド port として注入し、ワークフローで EventContext を一度だけ作って純粋な状態遷移へ渡す。",
        notByType: "ワークフローが port を1回だけ呼ぶことと、Date や randomUUID を直接呼ばないことは、テストとレビューで確認する。",
      },
      {
        invariant: "状態と監査記録は同時に残るか、どちらも残らない。",
        byType: "イベントにaggregateStateを含め、書き込み口をstore(event)へ絞る。",
        notByType: "永続化での原子性は、実装側の transaction で保証する必要がある。",
      },
      {
        invariant: "保存障害を、呼び出し側が選択できる業務上の失敗へ偽装しない。",
        byType: "業務ResultとPromiseのrejectを分け、保存の例外を外側の境界へ伝播する。",
        notByType: "最上位境界でのログ記録と500応答、診断情報や個人情報の非公開は結合テストで守る。",
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
  },
  {
    slug: "final",
    snapshot: "final",
    sequence: "Final",
    kind: "reference",
    title: "参照実装で境界をたどる",
    durationMinutes: 5,
    timeBreakdown: { brief: 0, teach: 4, exercise: 0, review: 1 },
    workflowFocus: "境界確認",
    workflowRisks: {
      resolvedFromPrevious: "入力境界・業務ワークフロー・出力と保存・例外境界を参照実装の対応箇所で確認した。",
      remainingForNext: "自分の業務で見直す境界と、最初に試す小さな改善を選ぶ。",
    },
    animal: { name: "Mugi", type: "cat", avatar: "🐈" },
    summary: "当日の到達点を、より大きな参照実装へ接続します。",
    incident: "当日の局所的な改善を、実運用を想定した構成へどう接続するかを確認する。",
    steps: [],
    decisions: [],
    finalReferences: [
      "examples/final/src/useCase/startExaminationUseCase.ts",
      finalAggregateTour.path,
    ],
  },
] as const satisfies readonly SessionSummary[];

export const sessionBySlug = (slug: string): SessionSummary | undefined =>
  sessions.find((session) => session.slug === slug);

export const sessionPath = (session: SessionSummary): string =>
  `/sessions/${session.slug}/`;

export const sessionNeighbors = (
  slug: string,
): Readonly<{ previous?: SessionSummary; next?: SessionSummary }> => {
  const index = sessions.findIndex((session) => session.slug === slug);
  if (index < 0) return {};
  const previous = sessions[index - 1];
  const next = sessions[index + 1];
  return {
    ...(previous === undefined ? {} : { previous }),
    ...(next === undefined ? {} : { next }),
  };
};
