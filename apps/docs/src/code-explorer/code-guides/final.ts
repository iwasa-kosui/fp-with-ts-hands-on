import type { CodeGuide } from "../code-guide";
import { finalAggregateTour } from "../../sessions/catalog";

const compositionRootPath = finalAggregateTour.path.replace(
  "examples/final/",
  "",
);

export default [
  {
    id: "final-use-case-pipeline",
    title: "最初に読む ResultAsync パイプライン",
    currentDesign:
      "当日の S4 と同じ形を、認可と永続化を含む use case へ広げています。",
    futureRisk: "全体から読むと概念が多いため、まず run の1本へ絞ります。",
    path: "src/useCase/startExaminationUseCase.ts",
    highlights: [{ startLineNumber: 83, endLineNumber: 105 }],
  },
  {
    id: "final-seven-aggregates",
    title: "1業務集約から7業務集約へ広がる配線",
    currentDesign: `${finalAggregateTour.aggregates.join("・")}の7集約を composition root で配線しています。`,
    futureRisk:
      "個別ファイルから読み始めると集約間の接続が見えないため、composition root から辿ります。",
    path: compositionRootPath,
    highlights: [{ startLineNumber: 202, endLineNumber: 244 }],
  },
  {
    id: "final-transaction-store",
    title: "in-memory から SQLite transaction へ広がる",
    currentDesign: "状態更新とイベント追加を1つの transaction で行います。",
    futureRisk: "単純な dual-write へ戻すと、状態と監査記録が分離します。",
    path: "src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
    highlights: [{ startLineNumber: 140, endLineNumber: 153 }],
  },
] as const satisfies readonly CodeGuide[];
