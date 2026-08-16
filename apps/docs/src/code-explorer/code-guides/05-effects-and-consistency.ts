import type { CodeGuide } from "../code-guide";

export default [
  {
    id: "hidden-nondeterminism",
    title: "output event の時刻と ID をユースケース内で生成している",
    currentDesign: "Date と randomUUID を直接呼び、同じ入力でも output event が変わります。",
    futureRisk: "期待値を固定できず、テストが実行時刻に依存します。",
    path: "src/useCase/startExamination.ts",
    highlights: [{ startLineNumber: 42, endLineNumber: 64 }],
  },
  {
    id: "dual-write",
    title: "side effects が2つの保存処理へ分かれている",
    currentDesign: "side effects として stateStore.save と eventLog.append を順番に await しています。",
    futureRisk: "片方だけ成功すると、記録のない状態変更が残ります。",
    path: "src/useCase/startExamination.ts",
    highlights: [{ startLineNumber: 66, endLineNumber: 69 }],
  },
] as const satisfies readonly CodeGuide[];
