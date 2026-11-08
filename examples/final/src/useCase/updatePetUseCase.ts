import {
  err,
  ok,
  ResultAsync,
  type Result,
  type ResultAsync as UseResultAsync,
} from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { OwnerId } from "../domain/owner/index.js";
import { Pet } from "../domain/pet/index.js";
import type { PetId } from "../domain/pet/index.js";
import type { PetName } from "../domain/pet/index.js";
import type { PetSpecies } from "../domain/pet/index.js";
import type { PetByIdResolver } from "../domain/pet/index.js";
import type { PetUpdatedStore } from "../domain/pet/index.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserByIdResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

export type PetView = Readonly<{
  petId: PetId;
  ownerId: OwnerId;
  name: PetName;
  species: PetSpecies;
}>;
export type UseCaseInput = Readonly<{
  actorUserId: UserId;
  petId: PetId;
  name: PetName;
  species: PetSpecies;
}>;
export type UseCaseOk = Readonly<{ pet: PetView }>;
export type PetNotFound = Readonly<{ kind: "PetNotFound"; petId: PetId }>;
export type UseCaseError =
  | UnauthorizedError
  | PetNotFound;
export type UseCaseOutput = UseResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  petResolver: PetByIdResolver;
  petUpdatedStore: PetUpdatedStore;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;
export type UpdatePetUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

const ensurePet =
  (petId: PetId) =>
  (pet: Pet | undefined): Result<Pet, PetNotFound> =>
    pet === undefined ? err({ kind: "PetNotFound", petId }) : ok(pet);
const toView = (pet: Pet): PetView => ({
  petId: pet.petId,
  ownerId: pet.ownerId,
  name: pet.name,
  species: pet.species,
});
const createEvent =
  (dependencies: Dependencies, input: UseCaseInput) => (pet: Pet) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        Pet.update({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId: input.actorUserId,
        })(pet, { name: input.name, species: input.species }),
      ),
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
      .andThen(createEvent(dependencies, input))
      .andThrough(dependencies.petUpdatedStore.store)
      .map((event) => ({ pet: toView(event.aggregateState) }));

export const UpdatePetUseCase = {
  create: (dependencies: Dependencies): UpdatePetUseCase => ({
    run: run(dependencies),
  }),
} as const;
