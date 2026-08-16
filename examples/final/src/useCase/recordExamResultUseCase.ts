import {
  err,
  ok,
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { Timestamp } from "../domain/aggregate/timestamp.js";
import type {
  Appointment,
  AwaitingPayment,
  InExamination,
} from "../domain/appointment/appointment.js";
import { Appointment as AppointmentAggregate } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type {
  AppointmentConflict,
  AppointmentStoreError,
} from "../domain/appointment/appointmentStores.js";
import { ExamResult } from "../domain/examResult/examResult.js";
import type { ExamId } from "../domain/examResult/examId.js";
import type { ExamResultItem } from "../domain/examResult/examResultItem.js";
import type { ExaminationCompletionStore } from "../domain/examResult/examResultStores.js";
import type { PetId } from "../domain/pet/petId.js";
import type { User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import {
  ensureAppointmentFound,
  ensureUserFound,
  type AppointmentNotFound,
  type UnauthorizedError,
} from "./errors.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  petId: PetId;
  collectedAt: Timestamp;
  items: readonly ExamResultItem[];
  needsFollowUp: boolean;
}>;
export type UseCaseOk = Readonly<{
  examResult: ExamResult;
  appointment: AwaitingPayment;
}>;
export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  expectedKind: "InExamination";
  actualKind: Exclude<Appointment["kind"], "InExamination">;
}>;
export type ExamResultPetMismatch = Readonly<{
  kind: "ExamResultPetMismatch";
  appointmentId: AppointmentId;
  expectedPetId: PetId;
  actualPetId: PetId;
}>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type UseCaseError =
  | UnauthorizedError
  | AppointmentNotFound
  | InvalidAppointmentState
  | ExamResultPetMismatch
  | IdentityGenerationFailed
  | AppointmentConflict;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type ExamIdGenerator = Readonly<{ generate: () => ExamId }>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  appointmentResolver: AppointmentByIdResolver;
  examinationCompletionStore: ExaminationCompletionStore;
  examIdGenerator: ExamIdGenerator;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type RecordExamResultUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

type Examiner = Extract<User, { kind: "Admin" | "Veterinarian" }>;
const ensureExaminer = (user: User): Result<Examiner, UnauthorizedError> =>
  user.kind === "Admin" || user.kind === "Veterinarian"
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const ensureInExamination = (
  appointment: Appointment,
): Result<InExamination, InvalidAppointmentState> =>
  appointment.kind === "InExamination"
    ? ok(appointment)
    : err({
        kind: "InvalidAppointmentState",
        appointmentId: appointment.appointmentId,
        expectedKind: "InExamination",
        actualKind: appointment.kind,
      });
const ensureAssigned =
  (user: Examiner) =>
  (appointment: InExamination): Result<InExamination, UnauthorizedError> =>
    user.kind === "Admin" || user.veterinarianId === appointment.veterinarianId
      ? ok(appointment)
      : err({ kind: "Unauthorized", actorUserId: user.userId });
const ensurePet =
  (input: UseCaseInput) =>
  (appointment: InExamination): Result<InExamination, ExamResultPetMismatch> =>
    appointment.petId === input.petId
      ? ok(appointment)
      : err({
          kind: "ExamResultPetMismatch",
          appointmentId: appointment.appointmentId,
          expectedPetId: appointment.petId,
          actualPetId: input.petId,
        });
const createEvents = (
  dependencies: Dependencies,
  input: UseCaseInput,
  appointment: InExamination,
) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => {
      const occurredAt = dependencies.clock.now();
      const result = {
        examId: dependencies.examIdGenerator.generate(),
        petId: input.petId,
        collectedAt: input.collectedAt,
        items: input.items,
        needsFollowUp: input.needsFollowUp,
      } as const satisfies ExamResult;
      const examResult = ExamResult.create({
        eventId: dependencies.eventIdGenerator.generate(),
        occurredAt,
        actorUserId: input.actorUserId,
      })(result);
      const appointmentCompleted = AppointmentAggregate.completeExamination({
        eventId: dependencies.eventIdGenerator.generate(),
        occurredAt,
        actorUserId: input.actorUserId,
      })(appointment, { examId: result.examId });
      return { examResult, appointmentCompleted } as const;
    }),
    (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
  );
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureExaminer)
      .andThen((user) =>
        dependencies.appointmentResolver
          .resolveById(input.appointmentId)
          .andThen(ensureAppointmentFound(input.appointmentId))
          .andThen(ensureInExamination)
          .andThen(ensureAssigned(user)),
      )
      .andThen(ensurePet(input))
      .andThen((appointment) => createEvents(dependencies, input, appointment))
      .andThrough(({ examResult, appointmentCompleted }) =>
        dependencies.examinationCompletionStore.store(
          examResult,
          appointmentCompleted,
        ),
      )
      .map(({ examResult, appointmentCompleted }) => ({
        examResult: examResult.aggregateState,
        appointment: appointmentCompleted.aggregateState,
      }));

export const RecordExamResultUseCase = {
  create: (dependencies: Dependencies): RecordExamResultUseCase => ({
    run: run(dependencies),
  }),
} as const;
