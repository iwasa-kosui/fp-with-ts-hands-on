export type SessionNavigationItem = Readonly<{
  slug: string;
  title: string;
}>;

export const sessionNavigationItems = [
  { slug: "00-system-handover", title: "業務とシステムを引き継ぐ" },
  { slug: "01-state-transitions", title: "予約の状態と遷移をモデル化する" },
  {
    slug: "02-adt-and-exhaustiveness",
    title: "予約の状態の分岐漏れを型で検出する",
  },
  {
    slug: "03-boundaries-and-pii",
    title: "診察開始の入力を境界で検証する",
  },
  { slug: "04-workflow-errors", title: "失敗をユースケースの結果として扱う" },
  {
    slug: "05-business-events-and-workflows",
    title: "データとパイプラインで予約キャンセルを設計する",
  },
  { slug: "06-effects-and-consistency", title: "副作用と整合性境界を設計する" },
  { slug: "final", title: "参照実装で境界をたどる" },
] as const satisfies readonly SessionNavigationItem[];
