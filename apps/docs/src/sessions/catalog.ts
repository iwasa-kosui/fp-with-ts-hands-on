export type SessionSummary = Readonly<{
  slug: string;
  snapshot: ExampleSnapshot;
  sequence:
    | "00"
    | "01"
    | "02"
    | "03"
    | "04"
    | "05"
    | "06"
    | "07"
    | "08"
    | "09"
    | "10"
    | "11"
    | "12"
    | "13"
    | "Final";
  label: string;
  title: string;
  durationMinutes: number;
  animal: Readonly<{ name: string; type: string; avatar: string }>;
  summary: string;
}>;

export type ExampleSnapshot =
  | "session-00"
  | "session-01"
  | "session-02"
  | "session-03"
  | "session-04"
  | "session-05"
  | "session-06"
  | "session-07"
  | "session-08"
  | "session-09"
  | "session-10"
  | "session-11"
  | "session-12"
  | "session-13"
  | "final";

export const sessions = [
  {
    slug: "00-onboarding",
    snapshot: "session-00",
    sequence: "00",
    label: "DOG",
    title: "オンボーディング: 退職した先人のコードを引き継ぐ",
    durationMinutes: 10,
    animal: { name: "DOG", type: "dog", avatar: "🐕" },
    summary:
      "WAN NYAN CLINIC の業務とアプリケーション、先人のコードに残る設計課題を概観します。",
  },
  {
    slug: "01-invariants",
    snapshot: "session-01",
    sequence: "01",
    label: "RABBIT",
    title: "守るべき不変条件を固定する",
    durationMinutes: 8,
    animal: { name: "RABBIT", type: "rabbit", avatar: "🐇" },
    summary: "事故を、これから守るべき業務上の要求として言葉にします。",
  },
  {
    slug: "02-state-vocabulary",
    snapshot: "session-02",
    sequence: "02",
    label: "BIRD",
    title: "状態の語彙を固定する",
    durationMinutes: 15,
    animal: { name: "BIRD", type: "bird", avatar: "🐦" },
    summary: "状態の名前を一箇所に集め、業務用語の揺れを止めます。",
  },
  {
    slug: "03-state-transitions",
    snapshot: "session-03",
    sequence: "03",
    label: "HAMSTER",
    title: "状態遷移を型で閉じる",
    durationMinutes: 12,
    animal: { name: "HAMSTER", type: "hamster", avatar: "🐹" },
    summary: "各状態に必要な情報と、許可された遷移元を表現します。",
  },
  {
    slug: "04-awaiting-payment",
    snapshot: "session-04",
    sequence: "04",
    label: "TURTLE",
    title: "会計待ちを表す",
    durationMinutes: 12,
    animal: { name: "TURTLE", type: "turtle", avatar: "🐢" },
    summary: "診察完了と会計の間にある業務上の状態を型へ加えます。",
  },
  {
    slug: "05-cancellation",
    snapshot: "session-05",
    sequence: "05",
    label: "FOX",
    title: "キャンセルと終端状態を分ける",
    durationMinutes: 10,
    animal: { name: "FOX", type: "fox", avatar: "🦊" },
    summary: "通常フローへ戻してはいけない状態を、遷移の型で守ります。",
  },
  {
    slug: "06-input-boundary",
    snapshot: "session-06",
    sequence: "06",
    label: "CAT",
    title: "外部入力を境界で検証する",
    durationMinutes: 13,
    animal: { name: "CAT", type: "cat", avatar: "🐈" },
    summary: "unknown な入力を Schema で業務に渡せる値へ一方向に変換します。",
  },
  {
    slug: "07-meaningful-values",
    snapshot: "session-07",
    sequence: "07",
    label: "PENGUIN",
    title: "意味の違う値を分ける",
    durationMinutes: 10,
    animal: { name: "PENGUIN", type: "penguin", avatar: "🐧" },
    summary: "同じ primitive でも、用途が異なる ID・日時・金額を取り違えないようにします。",
  },
  {
    slug: "08-pii-output",
    snapshot: "session-08",
    sequence: "08",
    label: "KOALA",
    title: "PII を出力境界で守る",
    durationMinutes: 10,
    animal: { name: "KOALA", type: "koala", avatar: "🐨" },
    summary: "連絡先を持つ必要と、ログなどへ露出させない必要を両立します。",
  },
  {
    slug: "09-typed-failures",
    snapshot: "session-09",
    sequence: "09",
    label: "OTTER",
    title: "予期可能な失敗を値にする",
    durationMinutes: 15,
    animal: { name: "OTTER", type: "otter", avatar: "🦦" },
    summary: "存在しない予約や不正な状態を、呼び出し側が扱える失敗理由で返します。",
  },
  {
    slug: "10-success-events",
    snapshot: "session-10",
    sequence: "10",
    label: "PANDA",
    title: "成功だけをイベントとして記録する",
    durationMinutes: 12,
    animal: { name: "PANDA", type: "panda", avatar: "🐼" },
    summary: "成功した状態変更だけを、業務上の出来事として組み立てます。",
  },
  {
    slug: "11-use-case-ports",
    snapshot: "session-11",
    sequence: "11",
    label: "HORSE",
    title: "use case で副作用を合成する",
    durationMinutes: 15,
    animal: { name: "HORSE", type: "horse", avatar: "🐴" },
    summary: "読み込み、業務判断、保存を用途の狭い port で合成します。",
  },
  {
    slug: "12-atomicity-and-conflicts",
    snapshot: "session-12",
    sequence: "12",
    label: "ELEPHANT",
    title: "原子性と競合を守る",
    durationMinutes: 16,
    animal: { name: "ELEPHANT", type: "elephant", avatar: "🐘" },
    summary: "projection と event を同時に確定し、古い操作を型付きの競合として返します。",
  },
  {
    slug: "13-safe-follow-up",
    snapshot: "session-13",
    sequence: "13",
    label: "SHEEP",
    title: "安全な follow-up を統合する",
    durationMinutes: 15,
    animal: { name: "SHEEP", type: "sheep", avatar: "🐑" },
    summary: "認可、重複防止、PII 非露出を follow-up の依頼に統合します。",
  },
  {
    slug: "final",
    snapshot: "final",
    sequence: "Final",
    label: "完成例",
    title: "Kamae に従う動物病院サンプル",
    durationMinutes: 7,
    animal: { name: "Mugi", type: "cat", avatar: "🐈" },
    summary: "全セッションの設計要素を統合した実装を確認します。",
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
