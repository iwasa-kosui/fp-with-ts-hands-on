import { sessionBySlug } from "../sessions/catalog";
import { projectFilesFor } from "./project-files";
import type { SessionWorkspace } from "./types";

const sessionWorkspaces = {
  "00-onboarding": {
    initialFile: "exercises/incident.test.ts",
    description:
      "先人が残したコードを手がかりに、今後向き合う設計上の課題を見渡します。",
    visibleFiles: [
      "exercises/incident.test.ts",
      "test/setup.test.ts",
      "src/appointment.ts",
      "src/logger.ts",
    ],
  },
  "01-invariants": {
    initialFile: "exercises/state-modeling.test.ts",
    description: "状態別の要求と作成対象を開始 snapshot で確認します。",
    visibleFiles: [
      "exercises/state-modeling.test.ts",
      "test/incident-requirements.test.ts",
      "src/appointment.ts",
      "src/logger.ts",
      "src/visit-lifecycle.ts",
    ],
  },
  "02-state-vocabulary": {
    initialFile: "exercises/state-vocabulary.test.ts",
    description: "状態名の語彙と、次に表す状態ごとの情報を確認します。",
    visibleFiles: [
      "exercises/state-vocabulary.test.ts",
      "test/state-modeling.test.ts",
      "src/domain/appointment.ts",
      "src/state-vocabulary.ts",
    ],
  },
  "03-state-transitions": {
    initialFile: "exercises/state-transitions.test.ts",
    description: "状態ごとの情報と、許可された遷移元を確認します。",
    visibleFiles: [
      "exercises/state-transitions.test.ts",
      "test/state-modeling.test.ts",
      "src/domain/appointment.ts",
    ],
  },
  "04-awaiting-payment": {
    initialFile: "exercises/awaiting-payment.test.ts",
    description: "会計待ちの要求と、直前までに閉じた状態遷移を確認します。",
    visibleFiles: [
      "exercises/awaiting-payment.test.ts",
      "test/state-modeling.test.ts",
      "src/domain/appointment.ts",
    ],
  },
  "05-cancellation": {
    initialFile: "exercises/cancellation.test.ts",
    description: "キャンセルの要求と、会計待ちまでの状態遷移を確認します。",
    visibleFiles: [
      "exercises/cancellation.test.ts",
      "test/state-modeling.test.ts",
      "src/domain/appointment.ts",
    ],
  },
  "06-input-boundary": {
    initialFile: "exercises/input-boundary.test.ts",
    description: "外部入力を受け取る前に、状態遷移を守れていることを確認します。",
    visibleFiles: [
      "exercises/input-boundary.test.ts",
      "test/cancellation.test.ts",
      "src/domain/appointment.ts",
      "src/domain/shared/schemaResult.ts",
      "src/domain/startExaminationInput.ts",
    ],
  },
  "07-meaningful-values": {
    initialFile: "exercises/value-meaning.test.ts",
    description: "入力検証の次に、値の用途まで区別する必要を確認します。",
    visibleFiles: [
      "exercises/value-meaning.test.ts",
      "test/start-examination-input.test.ts",
      "src/domain/appointment.ts",
      "src/domain/ownerId.ts",
      "src/domain/petId.ts",
      "src/domain/shared/schemaResult.ts",
      "src/domain/startExaminationInput.ts",
    ],
  },
  "08-pii-output": {
    initialFile: "exercises/pii-redaction.test.ts",
    description: "値の意味を守ったうえで、PII を出力から隠す要求を確認します。",
    visibleFiles: [
      "exercises/pii-redaction.test.ts",
      "test/value-objects.test.ts",
      "src/domain/appointmentId.ts",
      "src/domain/ownerId.ts",
      "src/domain/paymentAmount.ts",
      "src/domain/petId.ts",
      "src/domain/timestamp.ts",
      "src/domain/ownerContact.ts",
      "src/domain/shared/sensitive.ts",
    ],
  },
  "09-typed-failures": {
    initialFile: "exercises/typed-failures.test.ts",
    description: "PII を守ったうえで、予期可能な失敗を値として扱う要求を確認します。",
    visibleFiles: [
      "exercises/typed-failures.test.ts",
      "test/owner-contact.test.ts",
      "src/domain/appointment.ts",
      "src/domain/appointmentId.ts",
      "src/domain/ownerContact.ts",
      "src/domain/ownerId.ts",
      "src/domain/petId.ts",
      "src/domain/shared/sensitive.ts",
      "src/domain/startExaminationErrors.ts",
    ],
  },
  "10-success-events": {
    initialFile: "exercises/success-events.test.ts",
    description: "失敗理由を返せるようにした後、成功だけを出来事として記録します。",
    visibleFiles: [
      "exercises/success-events.test.ts",
      "test/start-examination-errors.test.ts",
      "src/domain/appointment.ts",
      "src/domain/appointmentId.ts",
      "src/domain/ownerId.ts",
      "src/domain/petId.ts",
      "src/domain/startExaminationErrors.ts",
      "src/domain/timestamp.ts",
    ],
  },
  "11-use-case-ports": {
    initialFile: "exercises/use-case-ports.test.ts",
    description: "成功イベントを、外部の読み書きから分離して合成する要求を確認します。",
    visibleFiles: [
      "exercises/use-case-ports.test.ts",
      "test/success-events.test.ts",
      "src/domain/appointment.ts",
      "src/domain/appointmentExaminationStarted.ts",
      "src/domain/appointmentId.ts",
      "src/domain/domainEvent.ts",
      "src/domain/ownerId.ts",
      "src/domain/petId.ts",
      "src/domain/timestamp.ts",
      "src/domain/veterinarianId.ts",
      "src/domain/appointmentResolver.ts",
      "src/domain/appointmentStores.ts",
      "src/useCase/startExaminationUseCase.ts",
    ],
  },
  "12-atomicity-and-conflicts": {
    initialFile: "exercises/atomicity-and-conflicts.test.ts",
    description: "port 合成の後、状態と event を原子的に保存する要求を確認します。",
    visibleFiles: [
      "exercises/atomicity-and-conflicts.test.ts",
      "test/use-case-ports.test.ts",
      "src/domain/appointment.ts",
      "src/domain/appointmentExaminationStarted.ts",
      "src/domain/appointmentId.ts",
      "src/domain/appointmentResolver.ts",
      "src/domain/appointmentStores.ts",
      "src/domain/domainEvent.ts",
      "src/domain/ownerId.ts",
      "src/domain/petId.ts",
      "src/domain/repositoryError.ts",
      "src/domain/startExaminationErrors.ts",
      "src/domain/startExaminationInput.ts",
      "src/domain/timestamp.ts",
      "src/domain/veterinarianId.ts",
      "src/useCase/startExaminationUseCase.ts",
      "src/adaptor/inMemoryAppointmentEventStore.ts",
    ],
  },
  "13-safe-follow-up": {
    initialFile: "exercises/safe-follow-up.test.ts",
    description: "原子保存を前提に、安全な follow-up 依頼を組み立てる要求を確認します。",
    visibleFiles: [
      "exercises/safe-follow-up.test.ts",
      "test/atomicity-and-conflicts.test.ts",
      "src/adaptor/inMemoryAppointmentEventStore.ts",
      "src/domain/appointment.ts",
      "src/domain/appointmentExaminationStarted.ts",
      "src/domain/appointmentId.ts",
      "src/domain/appointmentResolver.ts",
      "src/domain/appointmentStores.ts",
      "src/domain/domainEvent.ts",
      "src/domain/examId.ts",
      "src/domain/followUp/collectFollowUpTargets.ts",
      "src/domain/followUp/followUpRequested.ts",
      "src/domain/ownerContact.ts",
      "src/domain/ownerId.ts",
      "src/domain/paymentAmount.ts",
      "src/domain/petId.ts",
      "src/domain/repositoryError.ts",
      "src/domain/shared/schemaResult.ts",
      "src/domain/shared/sensitive.ts",
      "src/domain/startExaminationErrors.ts",
      "src/domain/startExaminationInput.ts",
      "src/domain/timestamp.ts",
      "src/domain/user/user.ts",
      "src/domain/user/userId.ts",
      "src/domain/veterinarianId.ts",
      "src/useCase/requestFollowUpUseCase.ts",
      "src/useCase/startExaminationUseCase.ts",
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
