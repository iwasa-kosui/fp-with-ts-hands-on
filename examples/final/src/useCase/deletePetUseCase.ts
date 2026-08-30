import {
  err,
  ok,
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import {
  Appointment,
  type Appointment as AppointmentState,
} from "../domain/appointment/index.js";
import type { AppointmentByPetIdResolver } from "../domain/appointment/index.js";
import { Pet } from "../domain/pet/index.js";
import type { PetId } from "../domain/pet/index.js";
import type { PetByIdResolver } from "../domain/pet/index.js";
import type { PetDeletedStore } from "../domain/pet/index.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
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
export type UseCaseError =
  | UnauthorizedError
  | PetNotFound
  | PetHasActiveAppointment
  | IdentityGenerationFailed;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  petResolver: PetByIdResolver;
  appointmentResolver: AppointmentByPetIdResolver;
  petDeletedStore: PetDeletedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type DeletePetUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

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
      .andThen(ensureUserFound(input.actorUserId))
      .andThen(ensureCanManageClinic)
      .andThen(() =>
        dependencies.petResolver.resolveById(input.petId),
      )
      .andThen(ensurePet(input.petId))
      .andThen((pet) =>
        dependencies.appointmentResolver
          .resolveByPetId(input.petId)
          .andThen(ensureNoActiveAppointments(input.petId))
          .map(() => pet),
      )
      .andThen(createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.petDeletedStore.store(event),
      )
      .map((event) => ({ petId: event.aggregateId }));

export const DeletePetUseCase = {
  create: (dependencies: Dependencies): DeletePetUseCase => ({
    run: run(dependencies),
  }),
} as const;
