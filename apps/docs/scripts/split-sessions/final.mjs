const expectedPages = [
  ["", "ここまでで分けた5つの境界", "background", "teach", 0.5],
  ["reference", "5つの境界は大きなコードでも保たれるか", "problem", "teach", 0.5],
  ["ports-and-adapters", "層の import の向き", "knowledge", "teach", 1.5],
  ["differences", "S06 との違い", "knowledge", "teach", 0.5],
  ["boundaries", "成功の流れで5つの境界をたどる", "solution", "teach", 1.5],
  ["boundary-failures", "失敗の依頼はどこまで進むか", "solution", "teach", 1.5],
  ["all-rules", "規則を広げてかけると3件出る", "solution", "review", 1.5],
  ["own-rule-review", "S00 で書いた決まりを見直す", "work", "review", 0.5],
  ["next-mechanism", "次に足す仕組みを1つ選ぶ", "work", "review", 1],
  ["summary", "全体のまとめ", "work", "review", 1],
  ["self-study", "別のユースケースをたどる", "advanced", "advanced", 0],
  ["persistence-notes", "projection と集約を読む", "advanced", "advanced", 0],
  ["software-factory", "ソフトウェアファクトリー", "advanced", "advanced", 0],
  ["agent-skill", "作った仕組みを AI に実行させるスキルを書く", "advanced", "advanced", 0],
];

export default {
  previous: "/sessions/06-effects-and-consistency/",
  previousTitle: "副作用と整合性境界を設計する",
  pages: expectedPages.map(([slug]) => slug),
  expectedPages,
  lastInTime: "summary",
};
