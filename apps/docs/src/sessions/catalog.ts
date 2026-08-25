export type SessionKind = "orientation" | "workshop" | "exercise" | "reference";

export type SolutionPresentation = "excerpt" | "completed-file";

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
  "不変条件を型と実行時の `if` のどちらで守っていますか。該当する行を示してください。",
  "この状態を壊すコードは、コンパイルを通りますか。",
  "自分の差分との違いを1つ挙げてください。優劣は決めません。",
] as const;

export const peerReviewPromises = [
  "人ではなく差分を見ます。「この差分は」で話し始め、優劣をつけません。",
  "本人は依頼文の1文だけを読み上げ、弁明しません。",
  "TAは選定基準を共有し、5回で班員全員を少なくとも1回選びます。選出は評価ではありません。",
] as const;

export const reviewDiffStatCommand = (snapshot: ExampleSnapshot): string =>
  `git diff --stat -- examples/${snapshot}`;

export const reviewStatusCommand = "git status --short";

export const commonReviewChecksFor = (
  snapshot: ExampleSnapshot,
): readonly [string, string, string] => [
  "`as` によるキャストが入っていないか全文検索して確認する。",
  `\`${reviewDiffStatCommand(snapshot)}\` で今回の snapshot だけを確認する。\`${reviewStatusCommand}\` で想定外の path がないか確認する。`,
  "不変条件を型で守っているか、実行時の `if` で守っているかを判定し、型で守れなかった残りを記録する。",
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
    adv: { articulate: 2, delegate: 9, verify: 2 },
    peerReview: { minutes: 7, pickCount: 2, questions: peerReviewQuestions },
    solutionSnapshot: "session-03",
    solutionPresentation: "excerpt",
    peerReviewPromises: "inline",
    animal: { name: "RABBIT", type: "rabbit", avatar: "🐇" },
    summary: "予約の5状態を判別共用体で表し、許可されていない状態遷移を型で拒否します。",
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
        invariant: "許可されていない状態遷移を型で拒否する。",
      },
      {
        invariant: "状態ごとの必須情報を欠かさない。",
      },
      {
        invariant: "状態を追加したとき、未対応の分岐をコンパイルエラーにする。",
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
      },
      {
        invariant: "予約はどの状態でも用途別の識別子を持つ。",
      },
      {
        invariant: "取り違えたコードはコンパイルできない。",
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
      },
      {
        invariant: "個人情報は既定でマスクし、値を取り出す場所を限定する。",
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
  },
  {
    slug: "06-effects-and-consistency",
    snapshot: "session-06",
    sequence: "06",
    kind: "exercise",
    title: "副作用と整合性境界を設計する",
    durationMinutes: 30,
    timeBreakdown: { brief: 4, teach: 3, exercise: 15, review: 8 },
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
      },
      {
        invariant: "状態と監査記録は同時に残るか、どちらも残らない。",
      },
      {
        invariant: "保存障害を、呼び出し側が選択できる業務上の失敗へ偽装しない。",
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
