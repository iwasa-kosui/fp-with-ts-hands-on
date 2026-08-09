import { err, ok, ResultAsync, type Result, type ResultAsync as UseResultAsync } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import { Appointment, type Appointment as AppointmentState, type Scheduled } from "../domain/appointment/appointment.js";
import type { AppointmentDuration } from "../domain/appointment/appointmentDuration.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentReason } from "../domain/appointment/appointmentReason.js";
import type { AppointmentByIdResolver } from "../domain/appointment/appointmentResolver.js";
import type { AppointmentStoreError, AppointmentUpdatedStore, StaleAppointmentVersion, VeterinarianScheduleConflict } from "../domain/appointment/appointmentStores.js";
import type { AppointmentVersion } from "../domain/appointment/appointmentVersion.js";
import type { ServiceCode } from "../domain/appointment/serviceCode.js";
import type { VeterinarianId } from "../domain/appointment/veterinarianId.js";
import type { Owner } from "../domain/owner/owner.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { OwnerByIdResolver } from "../domain/owner/ownerResolver.js";
import type { Pet } from "../domain/pet/pet.js";
import type { PetId } from "../domain/pet/petId.js";
import type { PetByIdResolver } from "../domain/pet/petResolver.js";
import type { User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver, UserListResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureAppointmentFound, ensureUserFound, type AppointmentNotFound, type UnauthorizedError } from "./errors.js";
import type { OwnerNotFound, PetNotFound, PetOwnerMismatch } from "./bookAppointmentUseCase.js";

export type UpdateAppointmentInput = Readonly<{
  actorUserId: UserId;
  appointmentId: AppointmentId;
  expectedVersion: AppointmentVersion;
  ownerId: OwnerId;
  petId: PetId;
  scheduledAt: import("../domain/aggregate/timestamp.js").Timestamp;
  durationMinutes: AppointmentDuration;
  serviceCode: ServiceCode;
  assignedVeterinarianId: VeterinarianId | null;
  visitReason: AppointmentReason;
}>;
export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  expectedKind: "Scheduled";
  actualKind: Exclude<AppointmentState["kind"], "Scheduled">;
}>;
export type PrepaidAppointmentImmutableFieldsChanged = Readonly<{
  kind: "PrepaidAppointmentImmutableFieldsChanged";
  appointmentId: AppointmentId;
}>;
export type VeterinarianNotFound = Readonly<{
  kind: "VeterinarianNotFound";
  veterinarianId: VeterinarianId;
}>;
export type IdentityGenerationFailed = Readonly<{ kind: "IdentityGenerationFailed" }>;
export type UseCaseRepositoryError = Readonly<{ kind: "RepositoryError"; operation: string }>;
export type UseCaseError =
  | UnauthorizedError | AppointmentNotFound | InvalidAppointmentState
  | OwnerNotFound | PetNotFound | PetOwnerMismatch | VeterinarianNotFound
  | PrepaidAppointmentImmutableFieldsChanged | StaleAppointmentVersion
  | VeterinarianScheduleConflict | IdentityGenerationFailed | UseCaseRepositoryError;
export type UseCaseOk = Readonly<{ appointment: Scheduled }>;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  userListResolver: UserListResolver;
  ownerResolver: OwnerByIdResolver;
  petResolver: PetByIdResolver;
  appointmentResolver: AppointmentByIdResolver;
  appointmentUpdatedStore: AppointmentUpdatedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type UpdateAppointmentUseCase = Readonly<{ run: (input: UpdateAppointmentInput) => UseCaseOutput }>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({ kind: "RepositoryError", operation: error.operation });
const toStoreError = (error: AppointmentStoreError): UseCaseRepositoryError | StaleAppointmentVersion | VeterinarianScheduleConflict =>
  error.kind === "RepositoryError" ? toRepositoryError(error) : error;
const ensureExpectedVersion = (input: UpdateAppointmentInput) => (appointment: AppointmentState): Result<AppointmentState, StaleAppointmentVersion> =>
  appointment.version === input.expectedVersion
    ? ok(appointment)
    : err({ kind: "StaleAppointmentVersion", appointmentId: input.appointmentId, expectedVersion: input.expectedVersion });
const ensureScheduled = (appointment: AppointmentState): Result<Scheduled, InvalidAppointmentState> =>
  appointment.kind === "Scheduled" ? ok(appointment) : err({ kind: "InvalidAppointmentState", appointmentId: appointment.appointmentId, expectedKind: "Scheduled", actualKind: appointment.kind });
const ensureOwner = (ownerId: OwnerId) => (owner: Owner | undefined): Result<Owner, OwnerNotFound> =>
  owner === undefined ? err({ kind: "OwnerNotFound", ownerId }) : ok(owner);
const ensurePet = (petId: PetId) => (pet: Pet | undefined): Result<Pet, PetNotFound> =>
  pet === undefined ? err({ kind: "PetNotFound", petId }) : ok(pet);
const ensurePetOwner = (ownerId: OwnerId) => (pet: Pet): Result<Pet, PetOwnerMismatch> =>
  pet.ownerId === ownerId ? ok(pet) : err({ kind: "PetOwnerMismatch", petId: pet.petId, expectedOwnerId: ownerId, actualOwnerId: pet.ownerId });
const ensurePrepaidFields = (input: UpdateAppointmentInput) => (appointment: Scheduled): Result<Scheduled, PrepaidAppointmentImmutableFieldsChanged> =>
  appointment.settlement.kind === "DepositReceived" && (appointment.petId !== input.petId || appointment.serviceCode !== input.serviceCode)
    ? err({ kind: "PrepaidAppointmentImmutableFieldsChanged", appointmentId: appointment.appointmentId })
    : ok(appointment);
const ensureVeterinarian = (veterinarianId: VeterinarianId | null) => (users: readonly User[]): Result<void, VeterinarianNotFound> =>
  veterinarianId === null || users.some((user) => user.kind === "Veterinarian" && user.veterinarianId === veterinarianId)
    ? ok(undefined)
    : err({ kind: "VeterinarianNotFound", veterinarianId });
const createEvent = (dependencies: Dependencies, input: UpdateAppointmentInput, appointment: Scheduled) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() => Appointment.update({
      eventId: dependencies.eventIdGenerator.generate(),
      occurredAt: dependencies.clock.now(),
      actorUserId: input.actorUserId,
    })(appointment, {
      ownerId: input.ownerId,
      petId: input.petId,
      scheduledAt: input.scheduledAt,
      durationMinutes: input.durationMinutes,
      serviceCode: input.serviceCode,
      assignedVeterinarianId: input.assignedVeterinarianId,
      visitReason: input.visitReason,
    })),
    (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
  );
const run = (dependencies: Dependencies) => (input: UpdateAppointmentInput): UseCaseOutput =>
  dependencies.userResolver.resolveById(input.actorUserId).mapErr(toRepositoryError)
    .andThen(ensureUserFound(input.actorUserId)).andThen(ensureCanManageClinic)
    .andThen(() => dependencies.appointmentResolver.resolveById(input.appointmentId).mapErr(toRepositoryError))
    .andThen(ensureAppointmentFound(input.appointmentId)).andThen(ensureExpectedVersion(input)).andThen(ensureScheduled)
    .andThen(ensurePrepaidFields(input))
    .andThen((appointment) => dependencies.ownerResolver.resolveById(input.ownerId).mapErr(toRepositoryError).andThen(ensureOwner(input.ownerId)).map(() => appointment))
    .andThen((appointment) => dependencies.petResolver.resolveById(input.petId).mapErr(toRepositoryError).andThen(ensurePet(input.petId)).andThen(ensurePetOwner(input.ownerId)).map(() => appointment))
    .andThen((appointment) => dependencies.userListResolver.resolveAll().mapErr(toRepositoryError).andThen(ensureVeterinarian(input.assignedVeterinarianId)).map(() => appointment))
    .andThen((appointment) => createEvent(dependencies, input, appointment))
    .andThrough((event) => dependencies.appointmentUpdatedStore.store(event).mapErr(toStoreError))
    .map((event) => ({ appointment: event.aggregateState }));

export const UpdateAppointmentUseCase = { create: (dependencies: Dependencies): UpdateAppointmentUseCase => ({ run: run(dependencies) }) } as const;
