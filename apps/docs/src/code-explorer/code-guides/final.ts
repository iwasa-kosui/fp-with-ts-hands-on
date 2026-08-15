import type { CodeGuide } from "../code-guide";

export default [
  {
    id: "final-use-case-pipeline",
    title: "最初に読む ResultAsync パイプライン",
    currentDesign: "当日の S4 と同じ形を、認可と永続化を含む use case へ広げています。",
    futureRisk: "全体から読むと概念が多いため、まず run の1本へ絞ります。",
    path: "src/useCase/startExaminationUseCase.ts",
    highlights: [{ startLineNumber: 83, endLineNumber: 107 }],
  },
  {
    id: "final-error-union",
    title: "1集約から複数の失敗へ広がる",
    currentDesign: "UseCaseError が認可・競合・永続化の失敗まで束ねています。",
    futureRisk: "失敗を文言へ戻すと、集約が増えたときに利用側の分岐が崩れます。",
    path: "src/useCase/errors.ts",
    highlights: [{ startLineNumber: 8, endLineNumber: 23 }],
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
