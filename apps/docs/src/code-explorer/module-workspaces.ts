import type { ModuleWorkspace } from "./types";

const moduleWorkspaces = {
  "00-break-the-app": {
    initialFile: "exercises/00-incident.test.ts",
    description: "事故を再現するテストとlegacy実装を編集して実行します。",
    visibleFiles: [
      "exercises/00-incident.test.ts",
      "test/00-setup.test.ts",
      "src/legacy/appointment.ts",
      "src/legacy/logger.ts",
    ],
  },
  "00-read-the-incident": {
    initialFile: "exercises/01-state-modeling.test.ts",
    description: "追加要求を表すテストと移行前後の状態モデルを比較します。",
    visibleFiles: [
      "exercises/01-state-modeling.test.ts",
      "test/01-state-modeling.test.ts",
      "src/legacy/appointment.ts",
      "src/legacy/logger.ts",
      "src/clinic/appointment.ts",
      "src/clinic/appointment-id.ts",
      "src/clinic/pet-id.ts",
      "src/clinic/veterinarian-id.ts",
    ],
  },
  "01-state-modeling": {
    initialFile: "exercises/01-state-modeling.test.ts",
    description: "状態遷移の実装と型・実行時テストを編集して実行します。",
    visibleFiles: [
      "exercises/01-state-modeling.test.ts",
      "test/01-state-modeling.test.ts",
      "src/clinic/appointment.ts",
      "src/clinic/appointment-id.ts",
      "src/clinic/pet-id.ts",
      "src/clinic/veterinarian-id.ts",
    ],
  },
  "02-boundary-and-ids": {
    initialFile: "exercises/02-boundary-and-ids.test.ts",
    description: "入力境界、ID、PII保護のコードとテストを編集して実行します。",
    visibleFiles: [
      "exercises/02-boundary-and-ids.test.ts",
      "test/02-boundary-and-ids.test.ts",
      "src/clinic/exam-result.ts",
      "src/clinic/owner-contact.ts",
      "src/clinic/owner-id.ts",
      "src/clinic/pet-id.ts",
      "src/shared/sensitive.ts",
    ],
  },
  "03-result-errors": {
    initialFile: "exercises/03-result-errors.test.ts",
    description: "Resultと成功イベントのuse caseとテストを編集して実行します。",
    visibleFiles: [
      "exercises/03-result-errors.test.ts",
      "test/03-result-errors.test.ts",
      "src/clinic/use-cases.ts",
      "src/clinic/appointment.ts",
      "src/clinic/appointment-id.ts",
      "src/clinic/appointment-repository.ts",
      "src/clinic/domain-event-store.ts",
      "src/clinic/domain-events.ts",
      "src/clinic/exam-result.ts",
      "src/clinic/owner-contact.ts",
      "src/clinic/pet-id.ts",
      "src/clinic/veterinarian-id.ts",
      "src/shared/result.ts",
      "src/shared/schema-result.ts",
      "src/shared/sensitive.ts",
    ],
  },
  "04-agent-review": {
    initialFile: "exercises/04-agent-review.test.ts",
    description: "レビュー観点とエージェント依頼の生成テストを編集して実行します。",
    visibleFiles: [
      "exercises/04-agent-review.test.ts",
      "test/04-agent-review.test.ts",
      "src/clinic/agent-review.ts",
    ],
  },
  "05-mini-integration": {
    initialFile: "exercises/05-follow-up.test.ts",
    description: "電話フォローuse caseと統合テストを編集して実行します。",
    visibleFiles: [
      "exercises/05-follow-up.test.ts",
      "test/05-follow-up.test.ts",
      "src/clinic/use-cases.ts",
      "src/clinic/appointment.ts",
      "src/clinic/appointment-id.ts",
      "src/clinic/appointment-repository.ts",
      "src/clinic/domain-event-store.ts",
      "src/clinic/domain-events.ts",
      "src/clinic/exam-result.ts",
      "src/clinic/owner-contact.ts",
      "src/clinic/pet-id.ts",
      "src/clinic/veterinarian-id.ts",
      "src/shared/result.ts",
      "src/shared/schema-result.ts",
      "src/shared/sensitive.ts",
    ],
  },
} as const;

export const moduleWorkspaceFor = (slug: string): ModuleWorkspace => {
  const workspace = moduleWorkspaces[slug as keyof typeof moduleWorkspaces];
  if (workspace === undefined) {
    throw new Error(`Unknown module workspace: ${slug}`);
  }

  return Object.freeze({ slug, ...workspace });
};
