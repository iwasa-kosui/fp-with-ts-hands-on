export type SessionKind = "orientation" | "exercise" | "reference";

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

export type SessionSummary = Readonly<{
  slug: string;
  snapshot: ExampleSnapshot;
  sequence: "00" | "01" | "02" | "03" | "04" | "Final";
  kind: SessionKind;
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
  steps: readonly ExerciseStep[];
  decisions: readonly Decision[];
  finalReferences: readonly string[];
}>;

export type ExampleSnapshot =
  | "session-00"
  | "session-01"
  | "session-02"
  | "session-03"
  | "session-04"
  | "session-05"
  | "final";

export const peerReviewQuestions = [
  "この差分は、不変条件を型で守っていますか、実行時の `if` で守っていますか。守っている行を1行、画面上で指してください。",
  "この状態を壊すコードを1行書くとしたら、どう書きますか。それはコンパイルを通りますか。",
  "自分の差分と違うところを1つ挙げてください。どちらが良いかは言わなくてよいです。",
] as const;

export const peerReviewPromises = [
  "見るのは差分であって人ではありません。発言は「この差分は」で始めます。",
  "良し悪しを判定しません。",
  "4回で班の全員が最低1回は当たるよう公平に配分します。選ばれることは評価ではありません。",
  "本人は弁明しません。読み上げるのは依頼文の1文だけです。",
  "TAは「よくできた実装」を選びません。選定基準を参加者にも開示します。",
] as const;

export const commonReviewChecks = [
  "`as` によるキャストが入っていないか全文検索する。",
  "`git diff --stat` でモジュール外のファイルが変更されていないか確認する。",
  "不変条件を型で守っているか、実行時の `if` で守っているか判定する。",
  "相互レビューの末尾1分で、型で守れなかった残りを記録する。",
] as const;

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
    slug: "00-onboarding",
    snapshot: "session-00",
    sequence: "00",
    kind: "orientation",
    title: "オンボーディング: 退職した先人のコードを引き継ぐ",
    durationMinutes: 15,
    timeBreakdown: { brief: 7, teach: 5, exercise: 0, review: 3 },
    animal: { name: "DOG", type: "dog", avatar: "🐕" },
    summary: "WAN NYAN CLINIC の業務とアプリケーション、先人のコードに残る設計課題を概観します。",
    incident: "会計済みの予約が診察中へ戻り、予約ログから飼い主のPIIが流出した。",
    steps: [],
    decisions: [],
    finalReferences: [],
  },
  {
    slug: "01-state-modeling",
    snapshot: "session-01",
    sequence: "01",
    kind: "exercise",
    title: "状態を型にする",
    durationMinutes: 30,
    timeBreakdown: { brief: 4, teach: 6, exercise: 13, review: 7 },
    adv: { articulate: 2, delegate: 9, verify: 2 },
    peerReview: { minutes: 7, pickCount: 2, questions: peerReviewQuestions },
    animal: { name: "RABBIT", type: "rabbit", avatar: "🐇" },
    summary: "予約の5状態と許可された遷移を型へ移し、終端状態からの逆行を防ぎます。",
    incident: "会計済みの来院が診察中へ戻され、会計が二度行われた。",
    exerciseCommand: "pnpm exercise:01",
    exerciseModule: {
      dir: "examples/session-01/src/domain/appointment",
      fileBudget: 2,
      lineBudget: 35,
    },
    steps: [
      {
        id: "s1-narrow-start",
        goal: "会計済み・キャンセル済みの来院は診察を開始できないようにする。",
        targets: ["examples/session-01/src/domain/appointment/transitions.ts"],
        solutions: [{
          path: "examples/session-02/src/domain/appointment/transitions.ts",
          symbol: "startExamination",
          lines: [14, 24],
        }],
      },
      {
        id: "s1-require-cancel-reason",
        goal: "キャンセルには必ず理由を残す。",
        targets: ["examples/session-01/src/domain/appointment/transitions.ts"],
        solutions: [{
          path: "examples/session-02/src/domain/appointment/transitions.ts",
          symbol: "cancel",
          lines: [33, 46],
        }],
      },
      {
        id: "s1-align-transitions",
        goal: "残る遷移も許可された遷移元だけを受け取る規約へ揃える。",
        targets: ["examples/session-01/src/domain/appointment/transitions.ts"],
        solutions: [{
          path: "examples/session-02/src/domain/appointment/transitions.ts",
          symbol: "checkIn",
          lines: [11, 31],
        }],
      },
      {
        id: "s1-exhaustive-label",
        goal: "状態を追加したら表示名の分岐をコンパイルエラーにする。",
        targets: ["examples/session-01/src/domain/appointment/statusLabel.ts"],
        solutions: [{
          path: "examples/session-02/src/domain/appointment/statusLabel.ts",
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
        notByType: "外部JSONからの復元には別途境界での検証が必要になる。",
      },
      {
        invariant: "状態を増やしたらすべての分岐を見直す。",
        byType: "assertNever で switch の網羅性を検査する。",
        notByType: "default を書き戻せば検査を回避できるためレビューが必要になる。",
      },
    ],
    finalReferences: [
      "examples/final/src/domain/appointment/appointment.ts",
      "examples/final/src/domain/shared/assertNever.ts",
    ],
  },
  {
    slug: "02-boundary-and-ids",
    snapshot: "session-02",
    sequence: "02",
    kind: "exercise",
    title: "値を型にする（境界・ID・PII）",
    durationMinutes: 30,
    timeBreakdown: { brief: 4, teach: 7, exercise: 12, review: 7 },
    adv: { articulate: 2, delegate: 8, verify: 2 },
    peerReview: { minutes: 7, pickCount: 2, questions: peerReviewQuestions },
    animal: { name: "BIRD", type: "bird", avatar: "🐦" },
    summary: "外部JSON、用途別ID、飼い主の連絡先を境界で安全な値へ変換します。",
    incident: "ラボのID取り違えで他の患者へ検査結果が付き、連絡先がログへ流出した。",
    exerciseCommand: "pnpm exercise:02",
    exerciseModule: {
      dir: "examples/session-02/src/boundary",
      fileBudget: 2,
      lineBudget: 24,
    },
    steps: [
      {
        id: "s2-parse-exam-result",
        goal: "形の違う検査JSONはドメイン型にならないようにする。",
        targets: ["examples/session-02/src/boundary/examResult.ts"],
        solutions: [{
          path: "examples/session-03/src/boundary/examResult.ts",
          symbol: "parseExamResult",
          lines: [7, 16],
        }],
      },
      {
        id: "s2-protect-contact",
        goal: "電話番号とメールは既定でログに出ないようにする。",
        targets: ["examples/session-02/src/boundary/ownerContact.ts"],
        solutions: [{
          path: "examples/session-03/src/boundary/ownerContact.ts",
          symbol: "OwnerContactSchema",
          lines: [6, 16],
        }],
      },
    ],
    decisions: [
      {
        invariant: "外部入力は境界を通ってからドメイン型になる。",
        byType: "unknownをschemaでparseし、Resultとして返す。",
        notByType: "境界を迂回してオブジェクトを直接作る経路は運用で閉じる必要がある。",
      },
      {
        invariant: "用途の異なるIDを取り違えない。",
        byType: "用途別のbranded typeで区別する。",
        notByType: "永続化上は同じTEXTなので復元時に再度parseする必要がある。",
      },
      {
        invariant: "PIIは既定でマスクし、値を剥がす場所を限定する。",
        byType: "Sensitiveで包み、unwrapの呼び出し箇所を明示する。",
        notByType: "unwrap後の文字列の扱いは型では守れない。",
      },
    ],
    finalReferences: [
      "examples/final/src/domain/shared/schemaResult.ts",
      "examples/final/src/domain/shared/sensitive.ts",
      "examples/final/src/domain/appointment/appointmentId.ts",
      "examples/final/src/domain/owner/ownerPhone.ts",
      "examples/final/src/domain/examResult/examResult.ts",
    ],
  },
  {
    slug: "03-result-errors",
    snapshot: "session-03",
    sequence: "03",
    kind: "exercise",
    title: "失敗を値にする",
    durationMinutes: 35,
    timeBreakdown: { brief: 5, teach: 7, exercise: 15, review: 8 },
    adv: { articulate: 2, delegate: 10, verify: 3 },
    peerReview: { minutes: 8, pickCount: 2, questions: peerReviewQuestions },
    animal: { name: "HAMSTER", type: "hamster", avatar: "🐹" },
    summary: "診察開始の予期できる失敗を、呼び出し側が扱える値として返します。",
    incident: "例外メッセージの変更で画面の分岐が壊れ、受付が失敗理由を追えなくなった。",
    exerciseCommand: "pnpm exercise:03",
    exerciseModule: {
      dir: "examples/session-03/src/useCase",
      fileBudget: 3,
      lineBudget: 77,
    },
    steps: [
      {
        id: "s3-invalid-state",
        goal: "受付済みでない状態を型付きの失敗として返す。",
        targets: ["examples/session-03/src/useCase/errors.ts"],
        solutions: [{
          path: "examples/session-04/src/useCase/errors.ts",
          symbol: "ensureCheckedIn",
          lines: [31, 36],
        }],
      },
      {
        id: "s3-not-found",
        goal: "予約が見つからない失敗を型付きの値として返す。",
        targets: ["examples/session-03/src/useCase/errors.ts"],
        solutions: [{
          path: "examples/session-04/src/useCase/errors.ts",
          symbol: "ensureAppointmentFound",
          lines: [23, 29],
        }],
      },
      {
        id: "s3-result-pipeline",
        goal: "失敗理由をandThenのパイプラインで運ぶ。",
        targets: ["examples/session-03/src/useCase/startExamination.ts"],
        solutions: [{
          path: "examples/session-04/src/useCase/startExamination.ts",
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
    slug: "04-effects-and-events",
    snapshot: "session-04",
    sequence: "04",
    kind: "exercise",
    title: "副作用を外に出す",
    durationMinutes: 35,
    timeBreakdown: { brief: 5, teach: 7, exercise: 15, review: 8 },
    adv: { articulate: 2, delegate: 10, verify: 3 },
    peerReview: { minutes: 8, pickCount: 2, questions: peerReviewQuestions },
    animal: { name: "TURTLE", type: "turtle", avatar: "🐢" },
    summary: "非決定性と保存をportへ出し、状態と監査記録を一度に保存します。",
    incident: "非決定的な値でテストが揺れ、状態だけ保存され監査記録が残らない予約が生まれた。",
    exerciseCommand: "pnpm exercise:04",
    exerciseModule: {
      dir: "examples/session-04/src/useCase",
      fileBudget: 3,
      lineBudget: 35,
    },
    steps: [
      {
        id: "s4-inject-context",
        goal: "同じclockとID generatorなら同じイベントを作る。",
        targets: [
          "examples/session-04/src/useCase/dependencies.ts",
          "examples/session-04/src/useCase/startExamination.ts",
        ],
        solutions: [
          {
            path: "examples/session-05/src/useCase/dependencies.ts",
            symbol: "Dependencies",
            lines: [18, 23],
          },
          {
            path: "examples/session-05/src/useCase/startExamination.ts",
            symbol: "startExamination",
            lines: [20, 43],
          },
        ],
      },
      {
        id: "s4-atomic-store",
        goal: "状態と監査記録を1回の保存で残す。",
        targets: ["examples/session-04/src/useCase/dependencies.ts"],
        solutions: [{
          path: "examples/session-05/src/useCase/dependencies.ts",
          symbol: "ExaminationStartedStore",
          lines: [10, 23],
        }],
      },
      {
        id: "s4-result-async",
        goal: "非同期保存後もイベントをパイプラインに残す。",
        targets: [
          "examples/session-04/src/useCase/errors.ts",
          "examples/session-04/src/useCase/startExamination.ts",
        ],
        solutions: [{
          path: "examples/session-05/src/useCase/startExamination.ts",
          symbol: "startExamination",
          lines: [20, 43],
        }],
      },
      {
        id: "s4-propagate-store-failure",
        goal: "保存失敗をRepositoryErrorとしてパイプラインに残す。",
        targets: [
          "examples/session-04/src/useCase/errors.ts",
          "examples/session-04/src/useCase/startExamination.ts",
        ],
        solutions: [{
          path: "examples/session-05/src/useCase/startExamination.ts",
          symbol: "startExamination",
          lines: [20, 43],
        }],
      },
    ],
    decisions: [
      {
        invariant: "ドメイン関数は同じ入力から同じ結果を返す。",
        byType: "ClockとEventIdGeneratorを1メソッドportとして注入する。",
        notByType: "portを迂回してDateやrandomUUIDを直接呼ぶことはレビューで防ぐ。",
      },
      {
        invariant: "状態と監査記録は同時に残るか、どちらも残らない。",
        byType: "イベントにaggregateStateを含め、書き込み口をstore(event)へ絞る。",
        notByType: "永続化での原子性は実装側のtransactionで保証する必要がある。",
      },
      {
        invariant: "保存はパイプラインの値を上書きしない。",
        byType: "ResultAsyncのandThroughで保存を通す。",
        notByType: "戻り値型が一致するとandThenでも型が通る場合がありテストが必要になる。",
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
    title: "参照実装ツアー",
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
