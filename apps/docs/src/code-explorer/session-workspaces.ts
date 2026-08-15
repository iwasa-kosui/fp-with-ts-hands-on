import { sessionBySlug } from "../sessions/catalog";
import { projectFilesFor } from "./project-files";
import type { SessionWorkspace } from "./types";

const sessionWorkspaces = {
  "00-onboarding": {
    initialFile: "src/legacy/appointment.ts",
    description:
      "先人が残したコードを手がかりに、今後向き合う設計上の課題を見渡します。",
    visibleFiles: ["src/legacy/appointment.ts", "src/legacy/logger.ts"],
  },
  "01-state-modeling": {
    initialFile: "exercises/state-modeling.test.ts",
    description: "状態別の要求と作成対象を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/state-modeling.test.ts",
      "test/transitions.test.ts",
      "test/setup.test.ts",
      "src/domain/appointment/appointment.ts",
      "src/domain/appointment/transitions.ts",
      "src/domain/appointment/statusLabel.ts",
    ],
  },
  "02-boundary-and-ids": {
    initialFile: "exercises/boundary-and-ids.test.ts",
    description: "入力・ID・PII の境界を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/boundary-and-ids.test.ts",
      "test/regression/state-modeling.test.ts",
      "src/domain/appointment/appointment.ts",
    ],
  },
  "03-result-errors": {
    initialFile: "exercises/result-errors.test.ts",
    description: "Result と成功イベントの要求を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/result-errors.test.ts",
      "test/regression/boundary-and-ids.test.ts",
      "test/regression/state-modeling.test.ts",
      "src/boundary/examResult.ts",
      "src/boundary/ownerContact.ts",
      "src/domain/appointment/appointment.ts",
      "src/domain/appointment/transitions.ts",
      "src/domain/appointment/statusLabel.ts",
      "src/domain/ids/appointmentId.ts",
      "src/domain/ids/examId.ts",
      "src/domain/ids/ownerId.ts",
      "src/domain/ids/petId.ts",
      "src/domain/ids/veterinarianId.ts",
      "src/shared/sensitive.ts",
      "src/useCase/startExamination.ts",
    ],
  },
  "04-agent-review": {
    initialFile: "exercises/effects-and-events.test.ts",
    description: "横断レビューの要求と既存設計を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/effects-and-events.test.ts",
      "test/regression/result-errors.test.ts",
      "src/domain/aggregate/clock.ts",
      "src/domain/aggregate/eventContext.ts",
      "src/domain/aggregate/eventId.ts",
      "src/domain/aggregate/eventIdGenerator.ts",
      "src/domain/appointment/examinationStarted.ts",
      "src/useCase/dependencies.ts",
      "src/useCase/errors.ts",
      "src/useCase/resultDependencies.ts",
      "src/useCase/startExamination.ts",
      "src/useCase/startExaminationResult.ts",
      "src/shared/schemaResult.ts",
      "src/shared/sensitive.ts",
    ],
  },
  "05-mini-integration": {
    initialFile: "test/regression/effects-and-events.test.ts",
    description: "電話フォロー要求と既存の設計判断を開始 snapshot で確認します。",
    visibleFiles: [
      "test/regression/effects-and-events.test.ts",
      "test/regression/result-errors.test.ts",
      "test/regression/boundary-and-ids.test.ts",
      "test/regression/state-modeling.test.ts",
      "test/in-memory-store.test.ts",
      "src/adaptor/inMemoryExaminationStartedStore.ts",
      "src/domain/aggregate/eventContext.ts",
      "src/domain/appointment/examinationStarted.ts",
      "src/useCase/dependencies.ts",
      "src/useCase/errors.ts",
      "src/useCase/startExamination.ts",
      "src/shared/schemaResult.ts",
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
