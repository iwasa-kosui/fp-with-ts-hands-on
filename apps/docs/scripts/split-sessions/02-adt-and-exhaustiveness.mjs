const expectedPages = [
  ["", "状態ごとの表示は別の関数が決める", "background", "brief", 0.5],
  ["no-show", "NoShow を足した翌朝、画面に「不明」が出た", "problem", "brief", 0.5],
  ["current-code", "default が足し忘れを隠す", "problem", "brief", 1],
  ["adt", "候補を数え切れる型", "knowledge", "teach", 2.5],
  ["never", "候補が0個の型", "knowledge", "teach", 2],
  ["assert-never", "足し忘れを型検査で見つける", "solution", "teach", 1.5],
  ["fail-fast", "すり抜けた値は見つけた場所で止める", "solution", "teach", 1],
  ["checks", "assertNever に直したコードを、次の変更からどう守るか", "solution", "teach", 1],
  ["exercise", "演習: 悪い変更を検出する仕組みを足す", "solution", "exercise", 7],
  ["peer-review", "相互レビュー", "solution", "review", 2],
  ["guard", "自分の業務で、どう防ぐか", "work", "review", 1],
];

export default {
  previous: "/sessions/01-state-transitions/",
  previousTitle: "予約の状態と遷移をモデル化する",
  next: "/sessions/03-boundaries-and-pii/",
  nextTitle: "診察開始の入力を境界で検証する",
  pages: expectedPages.map(([slug]) => slug),
  expectedPages,
  lastInTime: "guard",
};
