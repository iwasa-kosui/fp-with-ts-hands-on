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
import type { Timestamp } from "../domain/aggregate/timestamp.js";
import {
  Appointment,
  type Scheduled,
} from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { AppointmentBookedStore } from "../domain/appointment/appointmentStores.js";
import type { Owner } from "../domain/owner/owner.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { OwnerByIdResolver } from "../domain/owner/ownerResolver.js";
import type { Pet } from "../domain/pet/pet.js";
import type { PetId } from "../domain/pet/petId.js";
import type { PetByIdResolver } from "../domain/pet/petResolver.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import type { Sensitive } from "../domain/shared/sensitive.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  ownerId: OwnerId;
  petId: PetId;
  scheduledAt: Timestamp;
  reason: Sensitive<string>;
}>;
export type UseCaseOk = Readonly<{ appointment: Scheduled }>;
export type OwnerNotFound = Readonly<{
  kind: "OwnerNotFound";
  ownerId: OwnerId;
}>;
export type PetNotFound = Readonly<{ kind: "PetNotFound"; petId: PetId }>;
export type PetOwnerMismatch = Readonly<{
  kind: "PetOwnerMismatch";
  petId: PetId;
  expectedOwnerId: OwnerId;
  actualOwnerId: OwnerId;
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
  | OwnerNotFound
  | PetNotFound
  | PetOwnerMismatch
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type AppointmentIdGenerator = Readonly<{
  generate: () => AppointmentId;
}>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  ownerResolver: OwnerByIdResolver;
  petResolver: PetByIdResolver;
  appointmentBookedStore: AppointmentBookedStore;
  appointmentIdGenerator: AppointmentIdGenerator;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type BookAppointmentUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const ensureOwner =
  (ownerId: OwnerId) =>
  (owner: Owner | undefined): Result<Owner, OwnerNotFound> =>
    owner === undefined ? err({ kind: "OwnerNotFound", ownerId }) : ok(owner);
const ensurePet =
  (petId: PetId) =>
  (pet: Pet | undefined): Result<Pet, PetNotFound> =>
    pet === undefined ? err({ kind: "PetNotFound", petId }) : ok(pet);
const ensurePetOwner =
  (ownerId: OwnerId) =>
  (pet: Pet): Result<Pet, PetOwnerMismatch> =>
    pet.ownerId === ownerId
      ? ok(pet)
      : err({
          kind: "PetOwnerMismatch",
          petId: pet.petId,
          expectedOwnerId: ownerId,
          actualOwnerId: pet.ownerId,
        });
const createEvent = (dependencies: Dependencies, input: UseCaseInput) =>
  ResultAsync.fromPromise(
    Promise.resolve().then(() =>
      Appointment.book({
        eventId: dependencies.eventIdGenerator.generate(),
        occurredAt: dependencies.clock.now(),
        actorUserId: input.actorUserId,
      })({
        appointmentId: dependencies.appointmentIdGenerator.generate(),
        ownerId: input.ownerId,
        petId: input.petId,
        scheduledAt: input.scheduledAt,
        reason: input.reason,
      }),
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
        dependencies.ownerResolver
          .resolveById(input.ownerId)
          .mapErr(toRepositoryError),
      )
      .andThen(ensureOwner(input.ownerId))
      .andThen(() =>
        dependencies.petResolver
          .resolveById(input.petId)
          .mapErr(toRepositoryError),
      )
      .andThen(ensurePet(input.petId))
      .andThen(ensurePetOwner(input.ownerId))
      .andThen(() => createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.appointmentBookedStore
          .store(event)
          .mapErr(toRepositoryError),
      )
      .map((event) => ({ appointment: event.aggregateState }));

export const BookAppointmentUseCase = {
  create: (dependencies: Dependencies): BookAppointmentUseCase => ({
    run: run(dependencies),
  }),
} as const;
