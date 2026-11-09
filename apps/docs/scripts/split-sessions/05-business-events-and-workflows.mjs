const expectedPages = [
  ["", "キャンセルで変わる予約データ", "background", "brief", 1],
  ["tangled", "1つの関数に実装したキャンセル処理", "problem", "brief", 1],
  ["steps", "キャンセルの4つの工程への分割", "knowledge", "teach", 1.5],
  ["railway", "成功と失敗の2本のレール", "knowledge", "teach", 0.5],
  ["switch-points", "切り替え線としての S04 の andThen", "knowledge", "teach", 1],
  ["io-outside", "判定の関数の外への I/O の配置", "knowledge", "teach", 0.5],
  ["resolver-store", "Resolver と Store の役割", "knowledge", "teach", 0.5],
  ["why-rop", "工程の連結で解決できる課題", "solution", "teach", 0.5],
  ["cancel-success", "キャンセル成功時の値の流れ", "solution", "teach", 1.5],
  ["cancel-failures", "キャンセル失敗時の流れ", "solution", "teach", 1.5],
  ["dependency-rule", "domain から web への依存の禁止", "solution", "teach", 0.25],
  ["dependency-checks", "依存の向きの違反の検出", "solution", "teach", 0.25],
  ["exercise", "演習: 工程を守る仕組みの選択", "solution", "exercise", 6],
  ["takeaways", "担当業務の工程への分割", "work", "review", 2],
  ["further", "参考資料", "advanced", "advanced", 0],
];

export default {
  previous: "/sessions/04-workflow-errors/",
  previousTitle: "失敗をユースケースの結果として扱う",
  next: "/sessions/06-effects-and-consistency/",
  nextTitle: "副作用と整合性境界を設計する",
  pages: expectedPages.map(([slug]) => slug),
  expectedPages,
  lastInTime: "takeaways",
};
