export type SessionSummary = Readonly<{
  slug: string;
  snapshot: ExampleSnapshot;
  sequence: "00" | "01" | "02" | "03" | "04" | "05" | "Final";
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
  | "final";

export const sessions = [
  {
    slug: "00-onboarding",
    snapshot: "session-00",
    sequence: "00",
    label: "DOG",
    title: "オンボーディング: 退職した先人のコードを引き継ぐ",
    durationMinutes: 30,
    animal: { name: "DOG", type: "dog", avatar: "🐕" },
    summary:
      "WAN NYAN CLINIC の業務とアプリケーション、先人のコードに残る設計課題を概観します。",
  },
  {
    slug: "01-state-modeling",
    snapshot: "session-01",
    sequence: "01",
    label: "RABBIT",
    title: "状態遷移を型にする",
    durationMinutes: 30,
    animal: { name: "RABBIT", type: "rabbit", avatar: "🐇" },
    summary: "うさぎの予約で、キャンセル後の再診希望を安全に扱います。",
  },
  {
    slug: "02-boundary-and-ids",
    snapshot: "session-02",
    sequence: "02",
    label: "BIRD",
    title: "境界と ID を守る",
    durationMinutes: 25,
    animal: { name: "BIRD", type: "bird", avatar: "🐦" },
    summary: "鳥の外部検査結果と飼い主の連絡先を、安全な境界で扱います。",
  },
  {
    slug: "03-result-errors",
    snapshot: "session-03",
    sequence: "03",
    label: "HAMSTER",
    title: "失敗理由と変更記録を返す",
    durationMinutes: 30,
    animal: { name: "HAMSTER", type: "hamster", avatar: "🐹" },
    summary: "ハムスターの診察開始で、画面に失敗理由を返し成功だけを記録します。",
  },
  {
    slug: "04-agent-review",
    snapshot: "session-04",
    sequence: "04",
    label: "TURTLE",
    title: "エージェントレビューを設計する",
    durationMinutes: 20,
    animal: { name: "TURTLE", type: "turtle", avatar: "🐢" },
    summary: "カメの電話フォロー対象を、既存の設計判断を保って AI エージェントへ依頼します。",
  },
  {
    slug: "05-mini-integration",
    snapshot: "session-05",
    sequence: "05",
    label: "FOX",
    title: "ミニ総合演習",
    durationMinutes: 15,
    animal: { name: "FOX", type: "fox", avatar: "🦊" },
    summary: "キツネの検査結果から、電話フォローが必要な患者だけを安全に抽出します。",
  },
  {
    slug: "final",
    snapshot: "final",
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
