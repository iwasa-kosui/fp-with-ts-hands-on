type HomeListSection = Readonly<{
  title: string;
  introduction: string;
  items: readonly string[];
}>;

type HomeLink = Readonly<{
  label: string;
  href: string;
  description: string;
}>;

export type HomeContent = Readonly<{
  title: string;
  lead: string;
  promise: string;
  audience: HomeListSection;
  event: Readonly<{
    title: string;
    details: readonly Readonly<{ label: string; value: string }>[];
  }>;
  learningFlow: HomeListSection;
  preparation: HomeListSection & Readonly<{ note: string }>;
  modulesTitle: string;
  references: Readonly<{
    title: string;
    introduction: string;
    links: readonly HomeLink[];
  }>;
}>;

export const homeContent = {
  title: "FP with TypeScript — 動物病院ハンズオン",
  lead: "既存コードを全面刷新せず、1〜2関数の局所変更から変更容易性を高めます。",
  promise:
    "要求または事故を読み、不変条件を見つけ、技法を選び、テストまたは型検査で効果を確認します。",
  audience: {
    title: "対象者",
    introduction:
      "TypeScript 初級から中級の開発者を対象に、動物病院の予約・カルテ管理システムを題材として進めます。",
    items: [
      "TypeScript の関数、オブジェクト、union、テストコードを読める方",
      "関数型ドメインモデリングを既存の業務コードへ小さく適用したい方",
      "関数型プログラミングやドメイン駆動設計の実務経験は問いません",
    ],
  },
  event: {
    title: "開催情報",
    details: [
      { label: "日時", value: "2026年8月30日 15:00–18:00" },
      { label: "題材", value: "動物病院の予約・カルテ管理システム" },
      { label: "形式", value: "事故と追加要求を追う3時間のハンズオン" },
    ],
  },
  learningFlow: {
    title: "学習の流れ",
    introduction:
      "便利な WAN NYAN OS に増えた問題を、完成形の暗記ではなく段階的な問題解決で受け止めます。",
    items: [
      "会計済みの来院が診察中へ戻る事故を再現する",
      "要求と事故から、守るべき不変条件を言葉にする",
      "Discriminated Union、Branded Type、Sensitive、Result、Domain Event から必要な技法を選ぶ",
      "赤いテストを起点に局所変更し、テストまたは型検査で効果を確かめる",
      "AI エージェントに依頼するときの指示とレビュー観点へ変換する",
    ],
  },
  preparation: {
    title: "参加前の準備",
    introduction: "開始前にリポジトリを clone し、依存関係と通常テストを確認してください。",
    items: [
      "Node.js 20 以上",
      "pnpm",
      "Git",
      "TypeScript を編集できるエディタ",
      "pnpm install と pnpm test が成功する環境",
    ],
    note: "データベース、Docker、外部サービスの API キーは必要ありません。",
  },
  modulesTitle: "7つのモジュール",
  references: {
    title: "参考情報",
    introduction: "境界での PII 防御と、変更を後から追うための設計を教材内で参照します。",
    links: [
      {
        label: "ログの PII 漏洩を防止する",
        href: "https://kosui.me/posts/2026/03/16/typescript-pii-logging-defense",
        description: "TypeScript の型推論とランタイム境界で Sensitive な値を守る考え方です。",
      },
      {
        label: "TypeScript でドメインイベントを記録する",
        href: "https://kosui.me/posts/2025/05/06/142842",
        description: "成功した状態変更を、事故調査に使える出来事として記録する設計です。",
      },
    ],
  },
} as const satisfies HomeContent;
