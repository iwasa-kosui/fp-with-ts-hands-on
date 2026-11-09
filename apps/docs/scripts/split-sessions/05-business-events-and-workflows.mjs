const expectedPages = [
  ["", "予約のデータから始める", "background", "brief", 1],
  ["tangled", "キャンセルを1つの関数に書くと", "problem", "brief", 1],
  ["steps", "キャンセルを4つの工程に分ける", "knowledge", "teach", 1.5],
  ["railway", "成功と失敗の2本のレール", "knowledge", "teach", 0.5],
  ["switch-points", "S04 の andThen は切り替え線", "knowledge", "teach", 1],
  ["io-outside", "判定の関数の外に I/O を置く", "knowledge", "teach", 0.5],
  ["resolver-store", "Resolver と Store の役割", "knowledge", "teach", 0.5],
  ["why-rop", "工程でつなぐと何が解けるか", "solution", "teach", 0.5],
  ["cancel-success", "キャンセルが成功するときの値の流れ", "solution", "teach", 1.5],
  ["cancel-failures", "キャンセルが失敗するときの流れ", "solution", "teach", 1.5],
  ["dependency-rule", "domain は web に依存しない", "solution", "teach", 0.25],
  ["dependency-checks", "依存の向きの違反を検出する", "solution", "teach", 0.25],
  ["exercise", "演習: 工程を守る仕組みを選ぶ", "solution", "exercise", 6],
  ["takeaways", "自分の業務を工程に分ける", "work", "review", 2],
  ["further", "さらに読む", "advanced", "advanced", 0],
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
