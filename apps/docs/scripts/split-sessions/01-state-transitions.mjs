const expectedPages = [
  ["", "予約の6つの状態と遷移", "background", "teach", 1],
  ["double-billing", "会計済みの予約が診察中へ戻った事故", "problem", "brief", 1],
  ["current-code", "開始コードが誤りを検出できない原因", "problem", "brief", 1],
  ["state-types", "必要な情報が欠けた状態を型で排除する", "knowledge", "teach", 1.5],
  ["discriminated-union", "共通の kind で型を絞り込む", "knowledge", "teach", 1.5],
  ["narrow-arguments", "遷移関数の引数で、受け取れる状態を限定する", "solution", "teach", 2],
  ["checks", "誤った変更を仕組みで検出する", "solution", "teach", 1],
  ["exercise", "演習: 誤った変更を検出する仕組みを追加する", "solution", "exercise", 8],
  ["peer-review", "相互レビュー", "solution", "review", 2],
  ["guard", "担当業務での防止策", "work", "review", 1],
  ["pure-functions", "純粋関数", "advanced", "advanced", 0],
  ["preconditions", "事前条件", "advanced", "advanced", 0],
  ["other-languages", "Java と Rust", "advanced", "advanced", 0],
];

export default {
  previous: "/sessions/00-system-handover/",
  previousTitle: "業務とシステムを引き継ぐ",
  next: "/sessions/02-adt-and-exhaustiveness/",
  nextTitle: "予約の状態の分岐漏れを型で検出する",
  pages: expectedPages.map(([slug]) => slug),
  expectedPages,
  lastInTime: "guard",
};
