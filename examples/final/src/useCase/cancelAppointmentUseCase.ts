import {
  err,
  ok,
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import {
  Appointment,
  type Appointment as AppointmentState,
  type Canceled,
  type CheckedIn,
  type Scheduled,
} from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentVersion } from "../domain/appointment/appointmentVersion.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type { AppointmentCanceledStore, AppointmentStoreError, StaleAppointmentVersion } from "../domain/appointment/appointmentStores.js";
import type { CancellationReason } from "../domain/appointment/cancellationReason.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import {
  ensureAppointmentFound,
  ensureAppointmentVersion,
  ensureUserFound,
  type AppointmentNotFound,
  type UnauthorizedError,
} from "./errors.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  expectedVersion: AppointmentVersion;
  reason: CancellationReason;
}>;
export type UseCaseOk = Readonly<{ appointment: Canceled }>;
export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  expectedKind: "ScheduledOrCheckedIn";
  actualKind: Exclude<AppointmentState["kind"], "Scheduled" | "CheckedIn">;
}>;
export type IdentityGenerationFailed = Readonly<{
  kind: "IdentityGenerationFailed";
}>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  | UnauthorizedError
  | AppointmentNotFound
  | InvalidAppointmentState
  | IdentityGenerationFailed
  | StaleAppointmentVersion
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  appointmentResolver: AppointmentByIdResolver;
  appointmentCanceledStore: AppointmentCanceledStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type CancelAppointmentUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const toStoreError = (
  error: AppointmentStoreError,
): UseCaseRepositoryError | StaleAppointmentVersion =>
  error.kind === "StaleAppointmentVersion"
    ? error
    : error.kind === "RepositoryError"
      ? toRepositoryError(error)
      : { kind: "RepositoryError", operation: "CancelAppointmentUseCase.store" };
const ensureCancellable = (
  appointment: AppointmentState,
): Result<Scheduled | CheckedIn, InvalidAppointmentState> =>
  appointment.kind === "Scheduled" || appointment.kind === "CheckedIn"
    ? ok(appointment)
    : err({
        kind: "InvalidAppointmentState",
        appointmentId: appointment.appointmentId,
        expectedKind: "ScheduledOrCheckedIn",
        actualKind: appointment.kind,
      });
const createEvent =
  (dependencies: Dependencies, input: UseCaseInput) =>
  (appointment: Scheduled | CheckedIn) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        Appointment.cancel({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId: input.actorUserId,
        })(appointment, input.reason),
      ),
      (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
    );
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver
      .resolveById(input.actorUserId)
      .mapErr(toRepositoryError)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() =>
        dependencies.appointmentResolver
          .resolveById(input.appointmentId)
          .mapErr(toRepositoryError),
      )
      .andThen(ensureAppointmentFound(input.appointmentId))
      .andThen(ensureAppointmentVersion(input.appointmentId, input.expectedVersion))
      .andThen(ensureCancellable)
      .andThen(createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.appointmentCanceledStore
          .store(event)
          .mapErr(toStoreError),
      )
      .map((event) => ({ appointment: event.aggregateState }));

export const CancelAppointmentUseCase = {
  create: (dependencies: Dependencies): CancelAppointmentUseCase => ({
    run: run(dependencies),
  }),
} as const;
