const expectedPages = [
  ["", "ここまでで分けた5つの境界", "background", "teach", 0.5],
  ["reference", "大きなコードでの5つの境界の維持", "problem", "teach", 0.5],
  ["ports-and-adapters", "層の import の向き", "knowledge", "teach", 1.5],
  ["differences", "S06 との違い", "knowledge", "teach", 1],
  ["boundaries", "成功の流れで5つの境界を追跡する", "solution", "teach", 1.25],
  ["boundary-failures", "失敗の依頼の到達範囲", "solution", "teach", 1.25],
  ["all-rules", "ルールの適用範囲を広げたときの3件の指摘", "solution", "review", 1.5],
  ["own-rule-review", "S00 で記入した業務ルールを見直す", "work", "review", 0.5],
  ["next-mechanism", "次に追加する仕組みを1つ選ぶ", "work", "review", 1],
  ["summary", "全体のまとめ", "work", "review", 1],
  ["self-study", "別のユースケースを追跡する", "advanced", "advanced", 0],
  ["persistence-notes", "projection と集約を読む", "advanced", "advanced", 0],
  ["software-factory", "ソフトウェアファクトリー", "advanced", "advanced", 0],
  ["agent-skill", "追加した仕組みを AI に実行させるスキルを記載する", "advanced", "advanced", 0],
];

export default {
  previous: "/sessions/06-effects-and-consistency/",
  previousTitle: "副作用と整合性境界を設計する",
  pages: expectedPages.map(([slug]) => slug),
  expectedPages,
  lastInTime: "summary",
};
