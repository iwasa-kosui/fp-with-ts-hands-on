import type { CodeGuide } from "../code-guide";

export default [
  {
    id: "string-status",
    title: "状態を任意の文字列で表している",
    currentDesign: "status と更新先の状態を string で受け取っています。",
    futureRisk: "業務で使う状態と許可する遷移を型から判断できません。",
    path: "src/legacy/appointment.ts",
    highlights: [
      { startLineNumber: 26, endLineNumber: 26 },
      { startLineNumber: 51, endLineNumber: 60 },
    ],
  },
  {
    id: "optional-state-data",
    title: "状態固有の情報が複数の optional field に分散している",
    currentDesign: "診察、会計、キャンセルの情報が、一つの型にある複数の optional field として定義されています。",
    futureRisk: "どの状態で何が必須なのかを型から判断できません。",
    path: "src/legacy/appointment.ts",
    highlights: [{ startLineNumber: 3, endLineNumber: 14 }],
  },
  {
    id: "plain-string-ids",
    title: "用途の異なる ID がすべて string である",
    currentDesign: "予約、動物、飼い主、獣医師の ID が同じ string です。",
    futureRisk: "実行時には同じ形式の ID を TypeScript が区別できません。",
    path: "src/legacy/appointment.ts",
    highlights: [
      { startLineNumber: 16, endLineNumber: 23 },
      { startLineNumber: 30, endLineNumber: 37 },
    ],
  },
  {
    id: "throw-not-found",
    title: "予期できる失敗を throw している",
    currentDesign: "予約が見つからない場合に例外を送出します。",
    futureRisk: "呼び出し側が扱える失敗の種類を関数の型から判断できません。",
    path: "src/legacy/appointment.ts",
    highlights: [{ startLineNumber: 56, endLineNumber: 57 }],
  },
  {
    id: "raw-pii-log",
    title: "個人情報を含む値をそのままログへ渡している",
    currentDesign: "連絡先を含む予約オブジェクトを logger.info へ渡しています。",
    futureRisk: "ログへ出してよい情報の境界が値や型に表れていません。",
    path: "src/legacy/appointment.ts",
    highlights: [
      { startLineNumber: 21, endLineNumber: 23 },
      { startLineNumber: 44, endLineNumber: 47 },
    ],
  },
] as const satisfies readonly CodeGuide[];
