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
import type { OwnerId } from "../domain/owner/ownerId.js";
import { Pet } from "../domain/pet/pet.js";
import type { PetId } from "../domain/pet/petId.js";
import type { PetName } from "../domain/pet/petName.js";
import type { PetSpecies } from "../domain/pet/petSpecies.js";
import type { PetByIdResolver } from "../domain/pet/petResolver.js";
import type { PetUpdatedStore } from "../domain/pet/petStores.js";
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
  | IdentityGenerationFailed
  | UseCaseRepositoryError;
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

const toRepositoryError = (error: RepositoryError): UseCaseRepositoryError => ({
  kind: "RepositoryError",
  operation: error.operation,
});
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
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        Pet.update({
          eventId: dependencies.eventIdGenerator.generate(),
          occurredAt: dependencies.clock.now(),
          actorUserId: input.actorUserId,
        })(pet, { name: input.name, species: input.species }),
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
      .andThen(createEvent(dependencies, input))
      .andThrough((event) =>
        dependencies.petUpdatedStore.store(event).mapErr(toRepositoryError),
      )
      .map((event) => ({ pet: toView(event.aggregateState) }));

export const UpdatePetUseCase = {
  create: (dependencies: Dependencies): UpdatePetUseCase => ({
    run: run(dependencies),
  }),
} as const;
