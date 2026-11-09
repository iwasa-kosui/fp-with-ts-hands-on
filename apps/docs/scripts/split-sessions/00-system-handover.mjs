const expectedPages = [
  ["", "動物病院のシステムを引き継ぐ", "background", "brief", 1],
  ["incidents", "引き継ぎ初日に見つかった2件", "problem", "brief", 1.5],
  ["why-not-stopped", "なぜ会計済みの予約で診察を開始できたのか", "problem", "teach", 2],
  ["common-cause", "2件の事故に共通する原因", "problem", "teach", 1],
  ["map", "1回の依頼が本来通る道筋", "knowledge", "brief", 1],
  ["code-layout", "配布コードの構成", "knowledge", "teach", 0.5],
  ["when-noticed", "誤りに気づける場面は4つある", "knowledge", "teach", 0.5],
  ["goal", "この研修で目指す状態", "solution", "review", 1],
  ["roadmap", "どの回で、どの決まりをコードに書くか", "solution", "review", 0.5],
  ["your-rule", "あなたの現場の決まりを1つ選ぶ", "work", "review", 1],
  ["demo-screen", "デモ画面を手元で動かす", "advanced", "advanced", 0],
];

export default {
  next: "/sessions/01-state-transitions/",
  nextTitle: "予約の状態と遷移をモデル化する",
  pages: expectedPages.map(([slug]) => slug),
  expectedPages,
  lastInTime: "your-rule",
};
