import { err, ok, ResultAsync, type Result, type ResultAsync as UseResultAsync } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import { Appointment, type CheckedIn } from "../domain/appointment/appointment.js";
import type { AppointmentDuration } from "../domain/appointment/appointmentDuration.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentReason } from "../domain/appointment/appointmentReason.js";
import type { AppointmentStoreError, AppointmentWalkInRegisteredStore, VeterinarianScheduleConflict } from "../domain/appointment/appointmentStores.js";
import type { ReceptionNote } from "../domain/appointment/receptionNote.js";
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
import { ensureUserFound, type UnauthorizedError } from "./errors.js";
import type { AppointmentIdGenerator, IdentityGenerationFailed, OwnerNotFound, PetNotFound, PetOwnerMismatch } from "./bookAppointmentUseCase.js";
import type { VeterinarianNotFound } from "./updateAppointmentUseCase.js";

export type RegisterWalkInInput = Readonly<{
  actorUserId: UserId; ownerId: OwnerId; petId: PetId;
  durationMinutes: AppointmentDuration; serviceCode: ServiceCode;
  assignedVeterinarianId: VeterinarianId | null; visitReason: AppointmentReason;
  receptionNote: ReceptionNote | null;
}>;
export type UseCaseRepositoryError = Readonly<{ kind: "RepositoryError"; operation: string }>;
export type UseCaseError = UnauthorizedError | OwnerNotFound | PetNotFound | PetOwnerMismatch | VeterinarianNotFound | VeterinarianScheduleConflict | IdentityGenerationFailed | UseCaseRepositoryError;
export type UseCaseOk = Readonly<{ appointment: CheckedIn }>;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver; userListResolver: UserListResolver;
  ownerResolver: OwnerByIdResolver; petResolver: PetByIdResolver;
  appointmentWalkInRegisteredStore: AppointmentWalkInRegisteredStore;
  appointmentIdGenerator: AppointmentIdGenerator; clock: Clock; eventIdGenerator: EventIdGenerator;
}>;
export type RegisterWalkInUseCase = Readonly<{ run: (input: RegisterWalkInInput) => UseCaseOutput }>;
const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({ kind: "RepositoryError", operation: error.operation });
const toStoreError = (error: AppointmentStoreError): UseCaseRepositoryError | VeterinarianScheduleConflict => error.kind === "RepositoryError" ? toRepositoryError(error) : error.kind === "VeterinarianScheduleConflict" ? error : toRepositoryError({ kind: "RepositoryError", operation: "RegisterWalkInUseCase.store", cause: error });
const ensureOwner = (ownerId: OwnerId) => (owner: Owner | undefined): Result<Owner, OwnerNotFound> => owner === undefined ? err({ kind: "OwnerNotFound", ownerId }) : ok(owner);
const ensurePet = (petId: PetId) => (pet: Pet | undefined): Result<Pet, PetNotFound> => pet === undefined ? err({ kind: "PetNotFound", petId }) : ok(pet);
const ensurePetOwner = (ownerId: OwnerId) => (pet: Pet): Result<Pet, PetOwnerMismatch> => pet.ownerId === ownerId ? ok(pet) : err({ kind: "PetOwnerMismatch", petId: pet.petId, expectedOwnerId: ownerId, actualOwnerId: pet.ownerId });
const ensureVeterinarian = (veterinarianId: VeterinarianId | null) => (users: readonly User[]): Result<void, VeterinarianNotFound> => veterinarianId === null || users.some((user) => user.kind === "Veterinarian" && user.veterinarianId === veterinarianId) ? ok(undefined) : err({ kind: "VeterinarianNotFound", veterinarianId });
const createEvent = (dependencies: Dependencies, input: RegisterWalkInInput) => ResultAsync.fromPromise(
  Promise.resolve().then(() => Appointment.registerWalkIn({
    eventId: dependencies.eventIdGenerator.generate(),
    occurredAt: dependencies.clock.now(),
    actorUserId: input.actorUserId,
  })({
    appointmentId: dependencies.appointmentIdGenerator.generate(),
    ownerId: input.ownerId,
    petId: input.petId,
    durationMinutes: input.durationMinutes,
    serviceCode: input.serviceCode,
    assignedVeterinarianId: input.assignedVeterinarianId,
    visitReason: input.visitReason,
    receptionNote: input.receptionNote,
  })),
  (): IdentityGenerationFailed => ({ kind: "IdentityGenerationFailed" }),
);
const run = (dependencies: Dependencies) => (input: RegisterWalkInInput): UseCaseOutput => dependencies.userResolver.resolveById(input.actorUserId).mapErr(toRepositoryError)
  .andThen(ensureUserFound(input.actorUserId)).andThen(ensureCanManageClinic)
  .andThen(() => dependencies.ownerResolver.resolveById(input.ownerId).mapErr(toRepositoryError)).andThen(ensureOwner(input.ownerId))
  .andThen(() => dependencies.petResolver.resolveById(input.petId).mapErr(toRepositoryError)).andThen(ensurePet(input.petId)).andThen(ensurePetOwner(input.ownerId))
  .andThen(() => dependencies.userListResolver.resolveAll().mapErr(toRepositoryError)).andThen(ensureVeterinarian(input.assignedVeterinarianId))
  .andThen(() => createEvent(dependencies, input)).andThrough((event) => dependencies.appointmentWalkInRegisteredStore.store(event).mapErr(toStoreError))
  .map((event) => ({ appointment: event.aggregateState }));
export const RegisterWalkInUseCase = { create: (dependencies: Dependencies): RegisterWalkInUseCase => ({ run: run(dependencies) }) } as const;
