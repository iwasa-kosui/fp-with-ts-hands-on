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
} from "../domain/appointment/appointment.js";
import type { AppointmentByPetResolver } from "../domain/appointment/appointmentResolver.js";
import { Pet } from "../domain/pet/pet.js";
import type { PetId } from "../domain/pet/petId.js";
import type { PetResolver } from "../domain/pet/petResolver.js";
import type {
  PetDeletedStore,
  PetDeletedStoreError,
} from "../domain/pet/petStores.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

export type UseCaseInput = Readonly<{ actorUserId: UserId; petId: PetId }>;
export type UseCaseOk = Readonly<{ petId: PetId }>;
export type PetNotFound = Readonly<{ kind: "PetNotFound"; petId: PetId }>;
export type PetHasActiveAppointment = Readonly<{
  kind: "PetHasActiveAppointment";
  petId: PetId;
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
  | PetNotFound
  | PetHasActiveAppointment
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserResolver;
  petResolver: PetResolver;
  appointmentResolver: AppointmentByPetResolver;
  petDeletedStore: PetDeletedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type DeletePetUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
const toStoreError = (
  error: PetDeletedStoreError,
): PetHasActiveAppointment | UseCaseRepositoryError =>
  error.kind === "PetHasActiveAppointment" ? error : toRepositoryError(error);
const ensurePet =
  (petId: PetId) =>
  (pet: Pet | undefined): Result<Pet, PetNotFound> =>
    pet === undefined ? err({ kind: "PetNotFound", petId }) : ok(pet);
const ensureNoActiveAppointments =
  (petId: PetId) =>
  (
    appointments: readonly AppointmentState[],
  ): Result<void, PetHasActiveAppointment> =>
    appointments.some(Appointment.isActive)
      ? err({ kind: "PetHasActiveAppointment", petId })
      : ok(undefined);
const createEvent =
  (dependencies: Dependencies, input: UseCaseInput) => (pet: Pet) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        Pet.delete({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId: input.actorUserId,
        })(pet),
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
        dependencies.petResolver
          .resolveById(input.petId)
          .mapErr(toRepositoryError),
      )
      .andThen(ensurePet(input.petId))
      .andThen((pet) =>
        dependencies.appointmentResolver
          .resolveByPetId(input.petId)
          .mapErr(toRepositoryError)
          .andThen(ensureNoActiveAppointments(input.petId))
          .map(() => pet),
      )
      .andThen(createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.petDeletedStore.store(event).mapErr(toStoreError),
      )
      .map((event) => ({ petId: event.aggregateId }));

export const DeletePetUseCase = {
  create: (dependencies: Dependencies): DeletePetUseCase => ({
    run: run(dependencies),
  }),
} as const;
