import { projectFilesForSnapshot } from "../../code-explorer/project-files";
import { blockOf } from "../source-quotes";
import type { SessionSummary } from "../types";

export const session: SessionSummary = {
  slug: "05-business-events-and-workflows",
  snapshot: undefined,
  sequence: "05",
  kind: "workshop",
  title: "データと工程で予約キャンセルを設計する",
  durationMinutes: 18,
  timeBreakdown: { brief: 2, teach: 8, exercise: 6, review: 2 },
  animal: { name: "CAT", type: "cat", avatar: "🐈" },
  summary: "予約キャンセルを1つの関数に実装した場合の課題を確認し、工程に分割して失敗の流れを整理し、業務ロジックの外にI/Oを配置する構成を読みます。工程の条件と依存の向きを守る仕組みも選択します。",
  episode: [
    "受付担当者が、飼い主の依頼を受けて予約をキャンセルします。",
    "S04で診察開始の失敗を値で返す実装方法を学んだ開発者は、工程の多いキャンセルにも同じ方法を適用することにしました。",
    "開発者は、キャンセルで満たす条件（実行者の権限、診察開始前の予約、履歴の記録）と、変わるデータを見直すことにしました。",
  ],
  incident: "予約キャンセルで、実行者、予約の存在、現在状態、理由を一貫して確認できていない。",
  steps: [],
  decisions: [],
  finalReferences: [],
};

export const navigation = ({
  previous: {
    href: "/sessions/04-workflow-errors/",
    title: "失敗をユースケースの結果として扱う",
  },
  next: {
    href: "/sessions/06-effects-and-consistency/",
    title: "副作用と整合性境界を設計する",
  },
} as const);

export const cancelSource = blockOf(
  projectFilesForSnapshot("session-05-solution"),
  "src/domain/appointment/appointment.ts",
  "export const cancel = (",
  "});",
);
