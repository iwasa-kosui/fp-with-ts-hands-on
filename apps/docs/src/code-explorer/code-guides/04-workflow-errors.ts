import type { CodeGuide } from "../code-guide";

export default [
  {
    id: "throws-known-errors",
    title: "expected failures を例外メッセージへ戻している",
    currentDesign: "expected failures の union を宣言していても、guard の本体は throw します。",
    futureRisk: "呼び出し側が kind ではなく文言へ依存します。",
    path: "src/useCase/errors.ts",
    highlights: [
      { startLineNumber: 18, endLineNumber: 27 },
      { startLineNumber: 29, endLineNumber: 37 },
    ],
  },
  {
    id: "catch-collapses-errors",
    title: "catch が expected failures を1種類へ潰している",
    currentDesign: "not found と invalid state を try/catch でまとめて写像しています。",
    futureRisk: "予約なしまで InvalidAppointmentState として返り、受付が理由を判別できません。",
    path: "src/useCase/startExamination.ts",
    highlights: [{ startLineNumber: 15, endLineNumber: 40 }],
  },
] as const satisfies readonly CodeGuide[];
