const expectedPages = [
  ["", "状態ごとの表示を担当する関数", "background", "brief", 0.5],
  ["no-show", "NoShow の追加後に画面へ表示された「不明」", "problem", "brief", 0.5],
  ["current-code", "default が追加漏れの検出を妨げる原因", "problem", "brief", 1],
  ["adt", "値の候補を数え上げられる型", "knowledge", "teach", 2.5],
  ["never", "候補が0個の型", "knowledge", "teach", 2],
  ["assert-never", "型検査による追加漏れの検出", "solution", "teach", 1.5],
  ["fail-fast", "型検査を通過した不正な値の検出と処理の中断", "solution", "teach", 1],
  ["checks", "assertNever に修正したコードを次の変更から守る仕組み", "solution", "teach", 1],
  ["exercise", "演習: 誤った変更を検出する仕組みを追加する", "solution", "exercise", 7],
  ["peer-review", "相互レビュー", "solution", "review", 2],
  ["guard", "担当業務での防止策", "work", "review", 1],
  ["algebraic-data-types", "直積型と直和型による状態の表現", "advanced", "advanced", 0],
];

export default {
  previous: "/sessions/01-state-transitions/",
  previousTitle: "予約の状態と遷移をモデル化する",
  next: "/sessions/03-boundaries-and-pii/",
  nextTitle: "境界で入力を検証し、監査記録から個人情報を除外する",
  pages: expectedPages.map(([slug]) => slug),
  expectedPages,
  lastInTime: "guard",
};
