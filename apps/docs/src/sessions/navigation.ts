export type SessionNavigationItem = Readonly<{
  slug: string;
  title: string;
}>;

export const sessionNavigationItems = [
  { slug: "00-system-handover", title: "業務とシステムを引き継ぐ" },
  {
    slug: "01-business-events-and-workflows",
    title: "EventStormingとROPで予約キャンセルを設計する",
  },
  { slug: "02-state-transitions", title: "予約の状態と遷移をモデル化する" },
  {
    slug: "03-semantic-identifiers",
    title: "診察開始の識別子を型で区別する",
  },
  {
    slug: "04-boundaries-and-pii",
    title: "診察開始の入力を境界で検証する",
  },
  { slug: "05-workflow-errors", title: "失敗をユースケースの結果として扱う" },
  { slug: "06-effects-and-consistency", title: "副作用と整合性境界を設計する" },
  { slug: "final", title: "参照実装で境界をたどる" },
] as const satisfies readonly SessionNavigationItem[];
