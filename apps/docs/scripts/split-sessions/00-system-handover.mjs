const expectedPages = [
  ["", "動物病院のシステムを引き継ぐ", "background", "brief", 1.5],
  ["map", "1回の依頼が通る道筋", "background", "brief", 1],
  ["examination-mock", "「診察を開始する」を押すと何が起きるか", "background", "teach", 1.5],
  ["incidents", "引き継ぎ初日に見つかった2件", "problem", "brief", 1.5],
  ["records", "事故はデータのどこに残っているか", "problem", "teach", 0.5],
  ["code-layout", "配布コードの構成", "knowledge", "teach", 1],
  ["problems", "事故をたどって見つかった8つの問題", "solution", "review", 1],
  ["roadmap", "どの回で、どの問題を直すか", "solution", "review", 1],
  ["forecast", "自分の現場なら、どこで気づけるか", "work", "review", 1],
  ["demo-screen", "デモ画面を手元で動かす", "advanced", "advanced", 0],
];

export default {
  next: "/sessions/01-state-transitions/",
  nextTitle: "予約の状態と遷移をモデル化する",
  pages: expectedPages.map(([slug]) => slug),
  expectedPages,
  lastInTime: "forecast",
};
