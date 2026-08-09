import { err, ok, ResultAsync, type Result } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import {
  Appointment,
  type Appointment as AppointmentState,
  type AwaitingPayment,
  type CheckedIn,
  type InExamination,
  type Scheduled,
} from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type {
  AppointmentReceptionNoteUpdatedStore,
  AppointmentStoreError,
  StaleAppointmentVersion,
} from "../domain/appointment/appointmentStores.js";
import type { AppointmentVersion } from "../domain/appointment/appointmentVersion.js";
import type { ReceptionNote } from "../domain/appointment/receptionNote.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import {
  ensureAppointmentFound,
  ensureUserFound,
  type AppointmentNotFound,
  type UnauthorizedError,
} from "./errors.js";

type ReceptionNoteUpdatable = Scheduled | CheckedIn | InExamination | AwaitingPayment;

export type UpdateReceptionNoteInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  expectedVersion: AppointmentVersion;
  receptionNote: ReceptionNote | null;
}>;
export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  expectedKind: "Active";
  actualKind: "Paid" | "Canceled";
}>;
export type IdentityGenerationFailed = Readonly<{ kind: "IdentityGenerationFailed" }>;
export type UseCaseRepositoryError = Readonly<{ kind: "RepositoryError"; operation: string }>;
export type UseCaseError =
  | UnauthorizedError
  | AppointmentNotFound
  | InvalidAppointmentState
  | StaleAppointmentVersion
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  appointmentResolver: AppointmentByIdResolver;
  appointmentReceptionNoteUpdatedStore: AppointmentReceptionNoteUpdatedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type UpdateReceptionNoteUseCase = Readonly<{
  run: (input: UpdateReceptionNoteInput) => ResultAsync<Readonly<{ appointment: ReceptionNoteUpdatable }>, UseCaseError>;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const toStoreError = (
  error: AppointmentStoreError,
): StaleAppointmentVersion | UseCaseRepositoryError =>
  error.kind === "StaleAppointmentVersion"
    ? error
    : error.kind === "RepositoryError"
      ? toRepositoryError(error)
      : { kind: "RepositoryError", operation: "UpdateReceptionNoteUseCase.store" };
const ensureVersion =
  (input: UpdateReceptionNoteInput) =>
  (appointment: AppointmentState): Result<AppointmentState, StaleAppointmentVersion> =>
    appointment.version === input.expectedVersion
      ? ok(appointment)
      : err({
          kind: "StaleAppointmentVersion",
          appointmentId: input.appointmentId,
          expectedVersion: input.expectedVersion,
        });
const ensureUpdatable = (
  appointment: AppointmentState,
): Result<ReceptionNoteUpdatable, InvalidAppointmentState> =>
  appointment.kind !== "Paid" && appointment.kind !== "Canceled"
    ? ok(appointment)
    : err({
        kind: "InvalidAppointmentState",
        appointmentId: appointment.appointmentId,
        expectedKind: "Active",
        actualKind: appointment.kind,
      });
const createEvent = (
  dependencies: Dependencies,
  input: UpdateReceptionNoteInput,
  appointment: ReceptionNoteUpdatable,
) => ResultAsync.fromPromise(
  Promise.resolve().then(() => Appointment.updateReceptionNote({
    eventId: dependencies.eventIdGenerator.generate(),
    occurredAt: dependencies.clock.now(),
    actorUserId: input.actorUserId,
  })(appointment, input.receptionNote)),
  (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
);
const run =
  (dependencies: Dependencies) =>
  (input: UpdateReceptionNoteInput) =>
    dependencies.userResolver.resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() => dependencies.appointmentResolver.resolveById(input.appointmentId).mapErr(toRepositoryError))
      .andThen(ensureAppointmentFound(input.appointmentId))
      .andThen(ensureVersion(input))
      .andThen(ensureUpdatable)
      .andThen((appointment) => createEvent(dependencies, input, appointment))
      .andThrough((event) => dependencies.appointmentReceptionNoteUpdatedStore.store(event).mapErr(toStoreError))
      .map((event) => ({ appointment: event.aggregateState }));

export const UpdateReceptionNoteUseCase = {
  create: (dependencies: Dependencies): UpdateReceptionNoteUseCase => ({ run: run(dependencies) }),
} as const;
