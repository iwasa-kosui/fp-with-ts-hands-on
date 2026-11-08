import type { CodeGuide } from "../../code-explorer/code-guide";
import type { SessionNavigation, SessionSummary } from "../types";

export const session: SessionSummary = {
  slug: "00-system-handover",
  snapshot: "session-00",
  sequence: "00",
  kind: "orientation",
  title: "業務とシステムを引き継ぐ",
  durationMinutes: 10,
  timeBreakdown: { brief: 4, teach: 3, exercise: 0, review: 3 },
  animal: { name: "DOG", type: "dog", avatar: "🐕" },
  summary: "WAN NYAN CLINIC の現行業務と、システムに残る記録、起きている事故を確認します。",
  episode: [
    "新人エンジニアの初出勤の日、プリンターは事故報告を何枚も印刷していました。",
    "獣医師が別の予約と取り違えて「診察を開始する」を押し、会計済みの Mugi の予約は診察中へ戻りました。受付は同じ金額をもう一度請求しました。",
    "記録を調べると、飼い主の電話番号まで読めました。",
  ],
  incident: "会計済みの予約が診察中へ戻り、監査記録から飼い主の個人情報が読めた。",
  steps: [],
  decisions: [],
  finalReferences: [],
};

export const guides = ([
  {
    id: "string-status",
    title: "状態を任意の文字列で表している",
    currentDesign: "status と更新先の状態を string で受け取っています。",
    futureRisk: "どんな状態があり、どの状態からどの状態へ変えてよいかを、型を見ても判断できません。",
    path: "src/domain/appointment/appointment.ts",
    highlights: [{ startLineNumber: 11, endLineNumber: 11 }],
  },
  {
    id: "optional-state-data",
    title: "状態ごとの情報が複数の optional field に分かれている",
    currentDesign: "診察、会計、キャンセルの情報が、一つの型にある複数の optional field として定義されています。",
    futureRisk: "どの状態で何が必須なのかを型から判断できません。",
    path: "src/domain/appointment/appointment.ts",
    highlights: [{ startLineNumber: 13, endLineNumber: 13 }],
  },
  {
    id: "plain-string-ids",
    title: "用途の異なる ID がすべて string である",
    currentDesign: "予約、動物、飼い主、獣医師の ID が同じ string です。",
    futureRisk: "どれも string なので、ID を取り違えて渡しても TypeScript は誤りとして知らせません。",
    path: "src/domain/appointment/appointment.ts",
    highlights: [
      { startLineNumber: 3, endLineNumber: 3 },
      { startLineNumber: 5, endLineNumber: 5 },
    ],
  },
  {
    id: "session-00-unvalidated-exam-json",
    title: "外部の診察結果を any のまま受け取っている",
    currentDesign: "診察結果の parse は raw: any をそのまま返します。",
    futureRisk: "壊れた JSON や用途の違う ID が、検査されないまま予約データとして保存されます。",
    path: "src/boundary/examResult.ts",
    highlights: [{ startLineNumber: 4, endLineNumber: 4 }],
  },
  {
    id: "session-00-raw-pii-audit",
    title: "個人情報を予約の監査記録に残している",
    currentDesign: "操作後の予約内容を丸ごと監査記録として SQLite へ保存します。",
    futureRisk: "氏名、メールアドレス、電話番号を含む個人情報が監査記録から読めます。",
    path: "src/adaptor/secondary/sqlite/appointmentRepository.ts",
    highlights: [{ startLineNumber: 69, endLineNumber: 69 }],
  },
  {
    id: "session-00-message-mapped-errors",
    title: "失敗理由を例外メッセージで判定している",
    currentDesign: "catch した例外の message を部分一致で調べ、状態不正として画面へ戻します。",
    futureRisk: "予約が見つからない失敗とそれ以外の失敗を型で区別できず、表示と対応を誤ります。",
    path: "src/web/routes.ts",
    highlights: [{ startLineNumber: 204, endLineNumber: 205 }],
  },
  {
    id: "session-00-hidden-nondeterminism",
    title: "時刻と履歴 ID を処理の中で直接生成している",
    currentDesign: "診察開始の処理が現在時刻と UUID を直接生成します。",
    futureRisk: "同じ操作でも記録が毎回変わり、テストと事故調査の比較が安定しません。",
    path: "src/useCase/startExamination.ts",
    highlights: [
      { startLineNumber: 23, endLineNumber: 23 },
      { startLineNumber: 31, endLineNumber: 31 },
    ],
  },
  {
    id: "session-00-dual-write",
    title: "現在の予約内容と監査記録を別々に保存している",
    currentDesign: "予約を保存した後で、監査記録を別の処理で追加します。",
    futureRisk: "監査記録の追加が失敗すると、予約だけが変更され、記録が残りません。",
    path: "src/useCase/startExamination.ts",
    highlights: [{ startLineNumber: 29, endLineNumber: 30 }],
  },
] as const) satisfies readonly CodeGuide[];

export const navigation = ({
  previous: undefined,
  next: {
    href: "/sessions/01-state-transitions/",
    title: "予約の状態と遷移をモデル化する",
  },
} as SessionNavigation);
