import type { CodeGuide } from "./code-guide";

export const onboardingGuides = [
  {
    id: "string-status",
    title: "状態を任意の文字列で表している",
    currentDesign: "status と更新先の状態を string で受け取っています。",
    futureRisk: "業務で使う状態と許可する遷移を型から判断できません。",
    path: "src/appointment.ts",
    highlights: [
      { startLineNumber: 22, endLineNumber: 22 },
      { startLineNumber: 49, endLineNumber: 52 },
    ],
  },
  {
    id: "optional-state-data",
    title: "状態固有の情報が optional field に広がっている",
    currentDesign: "診察、会計、キャンセルの情報が1つの optional field 群に同居しています。",
    futureRisk: "どの状態で何が必須なのかを型から判断できません。",
    path: "src/appointment.ts",
    highlights: [{ startLineNumber: 3, endLineNumber: 10 }],
  },
  {
    id: "plain-string-ids",
    title: "用途の異なる ID がすべて string である",
    currentDesign: "予約、動物、飼い主の ID が同じ string です。",
    futureRisk: "同じ実行時形式の ID を TypeScript が区別できません。",
    path: "src/appointment.ts",
    highlights: [
      { startLineNumber: 12, endLineNumber: 19 },
      { startLineNumber: 26, endLineNumber: 33 },
    ],
  },
  {
    id: "throw-not-found",
    title: "予期可能な失敗を throw している",
    currentDesign: "予約が見つからない場合に例外を送出します。",
    futureRisk: "呼び出し側が扱う失敗の種類を関数の型から判断できません。",
    path: "src/appointment.ts",
    highlights: [{ startLineNumber: 54, endLineNumber: 55 }],
  },
  {
    id: "raw-pii-log",
    title: "個人情報を含む値をそのままログへ渡している",
    currentDesign: "連絡先を含む予約オブジェクトを logger.info へ渡しています。",
    futureRisk: "ログへ出してよい情報の境界が値や型に表れていません。",
    path: "src/appointment.ts",
    highlights: [
      { startLineNumber: 18, endLineNumber: 19 },
      { startLineNumber: 45, endLineNumber: 45 },
    ],
  },
] as const satisfies readonly CodeGuide[];
