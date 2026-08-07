import { sessionBySlug } from "../sessions/catalog";
import { projectFilesFor } from "./project-files";
import type { SessionWorkspace } from "./types";

const sessionWorkspaces = {
  "00-break-the-app": {
    initialFile: "exercises/incident.test.ts",
    description: "事故を再現するテストと開始 snapshot を編集して実行します。",
    visibleFiles: [
      "exercises/incident.test.ts",
      "test/setup.test.ts",
      "src/appointment.ts",
      "src/logger.ts",
    ],
  },
  "00-read-the-incident": {
    initialFile: "test/setup.test.ts",
    description: "事故報告と照合する開始 snapshot を編集して実行します。",
    visibleFiles: [
      "test/setup.test.ts",
      "exercises/incident.test.ts",
      "src/appointment.ts",
      "src/logger.ts",
    ],
  },
  "01-state-modeling": {
    initialFile: "exercises/state-modeling.test.ts",
    description: "状態別の要求と作成対象を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/state-modeling.test.ts",
      "test/incident-requirements.test.ts",
      "test/setup.test.ts",
      "src/appointment.ts",
      "src/logger.ts",
      "src/visit-lifecycle.ts",
    ],
  },
  "02-boundary-and-ids": {
    initialFile: "exercises/boundary-and-ids.test.ts",
    description: "入力・ID・PII の境界を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/boundary-and-ids.test.ts",
      "test/state-modeling.test.ts",
      "src/domain/appointment.ts",
    ],
  },
  "03-result-errors": {
    initialFile: "exercises/result-errors.test.ts",
    description: "Result と成功イベントの要求を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/result-errors.test.ts",
      "test/boundary-and-ids.test.ts",
      "test/state-modeling.test.ts",
      "src/boundary/exam-result.ts",
      "src/boundary/owner-contact.ts",
      "src/domain/appointment.ts",
      "src/domain/appointment-id.ts",
      "src/domain/exam-id.ts",
      "src/domain/owner-id.ts",
      "src/domain/pet-id.ts",
      "src/domain/veterinarian-id.ts",
      "src/shared/sensitive.ts",
    ],
  },
  "04-agent-review": {
    initialFile: "exercises/agent-review.test.ts",
    description: "横断レビューの要求と既存設計を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/agent-review.test.ts",
      "test/result-errors.test.ts",
      "src/application/start-examination.ts",
      "src/application/start-examination-error.ts",
      "src/infrastructure/in-memory-appointment-repository.ts",
      "src/infrastructure/in-memory-domain-event-store.ts",
      "src/ports/appointment-repository.ts",
      "src/ports/domain-event-store.ts",
      "src/shared/schema-result.ts",
      "src/shared/sensitive.ts",
    ],
  },
  "05-mini-integration": {
    initialFile: "exercises/follow-up.test.ts",
    description: "電話フォロー要求と既存の設計判断を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/follow-up.test.ts",
      "test/start-examination.test.ts",
      "test/fixtures.ts",
      "src/application/start-examination.ts",
      "src/infrastructure/in-memory-appointment-gateway.ts",
      "src/ports/appointment-resolver.ts",
      "src/ports/appointment-store.ts",
      "src/review/agent-review.ts",
      "src/shared/schema-result.ts",
      "src/shared/sensitive.ts",
    ],
  },
  final: {
    initialFile: "test/follow-up.test.ts",
    description: "全セッションを統合した完成 snapshot を編集して実行します。",
    visibleFiles: [
      "test/follow-up.test.ts",
      "test/start-examination.test.ts",
      "test/fixtures.ts",
      "src/application/collect-follow-up-targets.ts",
      "src/application/follow-up-candidate.ts",
      "src/application/follow-up-target.ts",
      "src/application/start-examination.ts",
      "src/domain/appointment.ts",
      "src/domain/exam-result.ts",
      "src/domain/owner-contact.ts",
      "src/infrastructure/in-memory-appointment-gateway.ts",
      "src/shared/schema-result.ts",
      "src/shared/sensitive.ts",
    ],
  },
} as const;

export const sessionWorkspaceFor = (slug: string): SessionWorkspace => {
  const session = sessionBySlug(slug);
  const workspace = sessionWorkspaces[slug as keyof typeof sessionWorkspaces];
  if (session === undefined || workspace === undefined) {
    throw new Error(`Unknown session workspace: ${slug}`);
  }

  const projectFiles = projectFilesFor(slug);
  const visibleFiles: readonly string[] = workspace.visibleFiles;
  if (!visibleFiles.includes(workspace.initialFile)) {
    throw new Error(`Initial file is not visible for session: ${slug}`);
  }
  const missingFiles = visibleFiles.filter(
    (path) => projectFiles[path] === undefined,
  );
  if (missingFiles.length > 0) {
    throw new Error(
      `Missing project files for session ${slug}: ${missingFiles.join(", ")}`,
    );
  }

  return Object.freeze({
    slug,
    snapshot: session.snapshot,
    ...workspace,
    visibleFiles: Object.freeze([...workspace.visibleFiles]),
  });
};
