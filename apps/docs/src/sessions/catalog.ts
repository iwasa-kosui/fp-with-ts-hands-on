export type SessionSummary = Readonly<{
  slug: string;
  sequence: "00-A" | "00-B" | "01" | "02" | "03" | "04" | "05" | "Final";
  label: string;
  title: string;
  durationMinutes: number;
  animal: Readonly<{ name: string; type: string; avatar: string }>;
  summary: string;
}>;

export const sessions = [
  {
    slug: "00-break-the-app",
    sequence: "00-A",
    label: "DOG",
    title: "導入事故を起こす",
    durationMinutes: 15,
    animal: { name: "DOG", type: "dog", avatar: "🐕" },
    summary: "WAN NYAN CLINIC の予約・カルテシステムで再診対応を扱います。",
  },
  {
    slug: "00-read-the-incident",
    sequence: "00-B",
    label: "CAT",
    title: "事故報告を読む",
    durationMinutes: 15,
    animal: { name: "CAT", type: "cat", avatar: "🐈" },
    summary: "キャンセル後の業務対応に必要な情報を整理します。",
  },
  {
    slug: "01-state-modeling",
    sequence: "01",
    label: "RABBIT",
    title: "状態遷移を型にする",
    durationMinutes: 30,
    animal: { name: "RABBIT", type: "rabbit", avatar: "🐇" },
    summary: "うさぎの予約で、キャンセル後の再診希望を安全に扱います。",
  },
  {
    slug: "02-boundary-and-ids",
    sequence: "02",
    label: "BIRD",
    title: "境界と ID を守る",
    durationMinutes: 25,
    animal: { name: "BIRD", type: "bird", avatar: "🐦" },
    summary: "鳥の外部検査結果と飼い主の連絡先を、安全な境界で扱います。",
  },
  {
    slug: "03-result-errors",
    sequence: "03",
    label: "HAMSTER",
    title: "失敗理由と変更記録を返す",
    durationMinutes: 30,
    animal: { name: "HAMSTER", type: "hamster", avatar: "🐹" },
    summary: "ハムスターの診察開始で、画面に失敗理由を返し成功だけを記録します。",
  },
  {
    slug: "04-agent-review",
    sequence: "04",
    label: "TURTLE",
    title: "エージェントレビューを設計する",
    durationMinutes: 20,
    animal: { name: "TURTLE", type: "turtle", avatar: "🐢" },
    summary: "カメの電話フォロー対象を、既存の設計判断を保って AI エージェントへ依頼します。",
  },
  {
    slug: "05-mini-integration",
    sequence: "05",
    label: "FOX",
    title: "ミニ総合演習",
    durationMinutes: 15,
    animal: { name: "FOX", type: "fox", avatar: "🦊" },
    summary: "キツネの検査結果から、電話フォローが必要な患者だけを安全に抽出します。",
  },
  {
    slug: "final",
    sequence: "Final",
    label: "完成例",
    title: "Kamae に従う動物病院サンプル",
    durationMinutes: 10,
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
