import { sessionBySlug } from "../sessions/catalog";
import { projectFilesFor } from "./project-files";
import type { SessionWorkspace } from "./types";

const sessionWorkspaces = {
  "00-system-handover": {
    initialFile: "src/legacy/appointment.ts",
    description:
      "先人が残したコードを手がかりに、今後向き合う設計上の課題を見渡します。",
    visibleFiles: ["src/legacy/appointment.ts", "src/legacy/logger.ts"],
  },
  "02-state-transitions": {
    initialFile: "exercises/state-modeling.test.ts",
    description: "current state の要求と作成対象を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/state-modeling.test.ts",
      "test/transitions.test.ts",
      "test/setup.test.ts",
      "src/domain/appointment/appointment.ts",
      "src/domain/appointment/transitions.ts",
      "src/domain/appointment/statusLabel.ts",
    ],
  },
  "03-semantic-identifiers": {
    initialFile: "exercises/semantic-identifiers.test.ts",
    description: "識別子の用途と、それを使う予約の状態を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/semantic-identifiers.test.ts",
      "test/regression/state-modeling.test.ts",
      "src/domain/ids/examId.ts",
      "src/domain/ids/petId.ts",
      "src/domain/ids/ownerId.ts",
      "src/domain/appointment/appointment.ts",
      "src/domain/appointment/transitions.ts",
      "src/domain/domain.test-types.ts",
    ],
  },
  "04-boundaries-and-pii": {
    initialFile: "exercises/boundary-and-pii.test.ts",
    description: "input の検証と PII の境界を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/boundary-and-pii.test.ts",
      "test/regression/semantic-identifiers.test.ts",
      "test/regression/state-modeling.test.ts",
      "src/domain/appointment/appointment.ts",
      "src/boundary/examResult.ts",
      "src/boundary/ownerContact.ts",
    ],
  },
  "05-workflow-errors": {
    initialFile: "exercises/result-errors.test.ts",
    description: "expected failures と Result の要求を開始 snapshot で確認します。",
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
      "src/useCase/errors.ts",
      "src/useCase/startExamination.ts",
    ],
  },
  "06-effects-and-consistency": {
    initialFile: "exercises/effects-and-events.test.ts",
    description: "output event と side effects の要求を開始 snapshot で確認します。",
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
      "src/useCase/startExamination.ts",
      "src/shared/schemaResult.ts",
      "src/shared/sensitive.ts",
    ],
  },
  final: {
    initialFile: "src/useCase/startExaminationUseCase.ts",
    description:
      "業務フローを Hono・Inertia・SQLite へ接続した完成アプリを確認します。",
    visibleFiles: [
      "src/useCase/startExaminationUseCase.ts",
      "src/useCase/errors.ts",
      "src/app.ts",
      "src/domain/appointment/appointment.ts",
      "src/domain/appointment/appointmentEvent.ts",
      "src/domain/appointment/appointmentResolver.ts",
      "src/domain/appointment/appointmentStores.ts",
      "src/domain/shared/schemaResult.ts",
      "src/domain/shared/sensitive.ts",
      "src/domain/followUp/collectFollowUpTargets.ts",
      "src/adaptor/primary/web/routes/appointmentRoutes.ts",
      "src/adaptor/secondary/sqlite/resolver/appointmentResolver.ts",
      "src/adaptor/secondary/sqlite/store/appointmentEventStore.ts",
    ],
  },
} as const;

export const sessionWorkspaceFor = (slug: string): SessionWorkspace => {
  const session = sessionBySlug(slug);
  const workspace = sessionWorkspaces[slug as keyof typeof sessionWorkspaces];
  if (
    session === undefined ||
    session.kind === "workshop" ||
    workspace === undefined
  ) {
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
  const missingTargets = session.steps
    .flatMap(({ targets }) => targets)
    .map((path) => path.replace(`examples/${session.snapshot}/`, ""))
    .filter((path) => !visibleFiles.includes(path));
  if (missingTargets.length > 0) {
    throw new Error(
      `Missing exercise targets for session ${slug}: ${missingTargets.join(", ")}`,
    );
  }

  return Object.freeze({
    slug,
    snapshot: session.snapshot,
    ...workspace,
    visibleFiles: Object.freeze([...workspace.visibleFiles]),
  });
};
