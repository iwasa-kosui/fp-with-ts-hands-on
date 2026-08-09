import { err, ok, ResultAsync, type Result } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import {
  Appointment,
  type Appointment as AppointmentState,
  type CheckedIn,
  type InExamination,
} from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type {
  AppointmentStoreError,
  ExaminationStartedStore,
  StaleAppointmentVersion,
  VeterinarianScheduleConflict,
} from "../domain/appointment/appointmentStores.js";
import type { AppointmentVersion } from "../domain/appointment/appointmentVersion.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type {
  UserByIdResolver,
  VeterinarianByIdResolver,
} from "../domain/user/userResolver.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
  ensureUserFound,
  type AppointmentNotFound,
  type InvalidAppointmentState,
  type UnauthorizedError,
} from "./errors.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  expectedVersion: AppointmentVersion;
  veterinarianId: VeterinarianId | undefined;
}>;
export type UseCaseOk = Readonly<{ appointment: InExamination }>;
export type IdentityGenerationFailed = Readonly<{ kind: "IdentityGenerationFailed" }>;
export type VeterinarianRequired = Readonly<{ kind: "VeterinarianRequired" }>;
export type VeterinarianMismatch = Readonly<{
  kind: "VeterinarianMismatch";
  appointmentId: AppointmentId;
  assignedVeterinarianId: VeterinarianId;
  actorVeterinarianId: VeterinarianId;
}>;
export type VeterinarianNotFound = Readonly<{
  kind: "VeterinarianNotFound";
  veterinarianId: VeterinarianId;
}>;
export type UseCaseError =
  | UnauthorizedError
  | AppointmentNotFound
  | InvalidAppointmentState
  | StaleAppointmentVersion
  | VeterinarianScheduleConflict
  | VeterinarianRequired
  | VeterinarianMismatch
  | VeterinarianNotFound
  | IdentityGenerationFailed
  | RepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  veterinarianResolver: VeterinarianByIdResolver;
  appointmentResolver: AppointmentByIdResolver;
  examinationStartedStore: ExaminationStartedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type StartExaminationUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

type Examiner = Extract<User, { kind: "Admin" | "Veterinarian" }>;
const ensureExaminer = (user: User): Result<Examiner, UnauthorizedError> =>
  user.kind === "Admin" || user.kind === "Veterinarian"
    ? ok(user)
    : err({ kind: "Unauthorized", actorUserId: user.userId });
const ensureVersion =
  (input: UseCaseInput) =>
  (appointment: AppointmentState): Result<AppointmentState, StaleAppointmentVersion> =>
    appointment.version === input.expectedVersion
      ? ok(appointment)
      : err({
          kind: "StaleAppointmentVersion",
          appointmentId: appointment.appointmentId,
          expectedVersion: input.expectedVersion,
        });
const ensureVeterinarianExists =
  (veterinarianId: VeterinarianId) =>
  (resolved: VeterinarianId | undefined): Result<void, VeterinarianNotFound> =>
    resolved === veterinarianId
      ? ok(undefined)
      : err({ kind: "VeterinarianNotFound", veterinarianId });

export const selectVeterinarian = (
  actor: Examiner,
  appointment: CheckedIn,
  requested: VeterinarianId | undefined,
): Result<
  VeterinarianId,
  UnauthorizedError | VeterinarianRequired | VeterinarianMismatch
> => {
  if (appointment.assignedVeterinarianId !== null) {
    return actor.kind === "Admin" ||
      actor.veterinarianId === appointment.assignedVeterinarianId
      ? ok(appointment.assignedVeterinarianId)
      : err({
          kind: "VeterinarianMismatch",
          appointmentId: appointment.appointmentId,
          assignedVeterinarianId: appointment.assignedVeterinarianId,
          actorVeterinarianId: actor.veterinarianId,
        });
  }
  if (actor.kind === "Veterinarian") return ok(actor.veterinarianId);
  return requested === undefined
    ? err({ kind: "VeterinarianRequired" })
    : ok(requested);
};

const createEvent = (
  dependencies: Pick<Dependencies, "clock" | "eventIdGenerator">,
  input: UseCaseInput,
  appointment: CheckedIn,
  veterinarianId: VeterinarianId,
) => ResultAsync.fromPromise(
  Promise.resolve().then(() => Appointment.startExamination({
    eventId: dependencies.eventIdGenerator.generate(),
    occurredAt: dependencies.clock.now(),
    actorUserId: input.actorUserId,
  })(appointment, veterinarianId)),
  (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
);
const toStoreError = (
  error: AppointmentStoreError,
): RepositoryError | StaleAppointmentVersion | VeterinarianScheduleConflict =>
  error.kind === "StaleAppointmentVersion" ||
  error.kind === "VeterinarianScheduleConflict"
    ? error
    : error.kind === "RepositoryError"
      ? error
      : {
          kind: "RepositoryError",
          operation: "StartExaminationUseCase.store",
          cause: error,
        };
const run =
  (dependencies: Dependencies) =>
  (input: UseCaseInput): UseCaseOutput =>
    dependencies.userResolver.resolveById(input.actorUserId)
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureExaminer)
      .andThen((actor) => dependencies.appointmentResolver.resolveById(input.appointmentId)
        .andThen(ensureAppointmentFound(input.appointmentId))
        .andThen(ensureVersion(input))
        .andThen(ensureCheckedIn)
        .andThen((appointment) => selectVeterinarian(actor, appointment, input.veterinarianId)
          .map((veterinarianId) => ({ actor, appointment, veterinarianId }))))
      .andThen((selection) =>
        selection.actor.kind === "Admin" &&
        selection.appointment.assignedVeterinarianId === null
          ? dependencies.veterinarianResolver.resolveById(selection.veterinarianId)
            .andThen(ensureVeterinarianExists(selection.veterinarianId))
            .map(() => selection)
          : ok(selection))
      .andThen(({ appointment, veterinarianId }) =>
        createEvent(dependencies, input, appointment, veterinarianId))
      .andThrough((event) => dependencies.examinationStartedStore.store(event).mapErr(toStoreError))
      .map((event) => ({ appointment: event.aggregateState }));

export const StartExaminationUseCase = {
  create: (dependencies: Dependencies): StartExaminationUseCase => ({ run: run(dependencies) }),
} as const;
