import type { CodeGuide } from "../code-guide";

export default [
  {
    id: "hidden-nondeterminism",
    title: "時刻と ID をユースケース内で生成している",
    currentDesign: "Date と randomUUID を直接呼び、同じ入力でもイベントが変わります。",
    futureRisk: "期待値を固定できず、テストが実行時刻に依存します。",
    path: "src/useCase/startExamination.ts",
    highlights: [{ startLineNumber: 42, endLineNumber: 64 }],
  },
  {
    id: "dual-write",
    title: "状態と監査記録を別々に保存している",
    currentDesign: "stateStore.save と eventLog.append を順番に await しています。",
    futureRisk: "片方だけ成功すると、記録のない状態変更が残ります。",
    path: "src/useCase/startExamination.ts",
    highlights: [{ startLineNumber: 66, endLineNumber: 72 }],
  },
] as const satisfies readonly CodeGuide[];
