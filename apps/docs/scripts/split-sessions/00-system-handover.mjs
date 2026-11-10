const expectedPages = [
  ["", "動物病院のシステムを引き継ぐ", "background", "brief", 1],
  ["incidents", "引き継ぎ初日に判明した2件の事故", "problem", "brief", 1.5],
  ["why-not-stopped", "会計済みの予約で診察を開始できた処理の流れ", "problem", "teach", 1.5],
  ["common-cause", "2件の事故に共通する原因", "problem", "teach", 1],
  ["code-layout", "業務ロジックの配置先", "knowledge", "brief", 1],
  ["hexagonal", "ヘキサゴナルアーキテクチャの考え方", "knowledge", "teach", 1],
  ["when-noticed", "誤りを検出できる4つの時点", "knowledge", "teach", 0.5],
  ["goal", "この教材で目指す状態", "solution", "review", 1],
  ["roadmap", "Session ごとに解決する内容", "solution", "review", 0.5],
  ["your-rule", "担当システムの暗黙の業務ルールを1つ選ぶ", "work", "review", 1],
  ["demo-screen", "デモ画面をローカル環境で起動する", "advanced", "advanced", 0],
];

export default {
  next: "/sessions/01-state-transitions/",
  nextTitle: "予約の状態と遷移をモデル化する",
  pages: expectedPages.map(([slug]) => slug),
  expectedPages,
  lastInTime: "your-rule",
};
