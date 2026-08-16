import type { CodeGuide } from "../code-guide";

export default [
  {
    id: "wide-transition-input",
    title: "current state を受け取る関数が Appointment 全体を受け入れている",
    currentDesign: "current state を型で絞らず、実行時の requireKind と throw に頼っています。",
    futureRisk: "禁止したい状態でも呼び出し側のコードはコンパイルが通り、as で結果を押し通せます。",
    path: "src/domain/appointment/transitions.ts",
    highlights: [
      { startLineNumber: 7, endLineNumber: 15 },
      { startLineNumber: 18, endLineNumber: 24 },
    ],
  },
  {
    id: "non-exhaustive-label",
    title: "current state の表示分岐が未知の状態を見逃す",
    currentDesign: "current state の kind を string として受け、default で不明を返します。",
    futureRisk: "状態を追加しても見直すべき分岐をコンパイラが知らせません。",
    path: "src/domain/appointment/statusLabel.ts",
    highlights: [{ startLineNumber: 3, endLineNumber: 17 }],
  },
] as const satisfies readonly CodeGuide[];
