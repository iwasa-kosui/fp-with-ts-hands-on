import { sessionBySlug } from "../sessions/catalog";
import { projectFilesFor } from "./project-files";
import type { SessionWorkspace } from "./types";

const sessionWorkspaces = {
  "00-onboarding": {
    initialFile: "src/appointment.ts",
    description:
      "先人が残したコードを手がかりに、今後向き合う設計上の課題を見渡します。",
    visibleFiles: ["src/appointment.ts", "src/logger.ts"],
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
      "src/review/agent-review.ts",
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
    initialFile: "test/useCase/startExaminationUseCase.test.ts",
    description:
      "業務フローを Hono・Inertia・SQLite へ接続した完成アプリを確認します。",
    visibleFiles: [
      "test/useCase/startExaminationUseCase.test.ts",
      "test/web/clinicFlow.test.ts",
      "src/app.ts",
      "src/domain/appointment/appointment.ts",
      "src/domain/appointment/appointmentEvent.ts",
      "src/domain/appointment/appointmentResolver.ts",
      "src/domain/appointment/appointmentStores.ts",
      "src/domain/shared/schemaResult.ts",
      "src/domain/shared/sensitive.ts",
      "src/useCase/startExaminationUseCase.ts",
      "src/adaptor/primary/web/routes/appointmentRoutes.ts",
      "src/adaptor/secondary/sqlite/resolver/appointmentResolver.ts",
      "src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
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
