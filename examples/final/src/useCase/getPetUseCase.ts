import { err, ok, type Result, type ResultAsync } from "neverthrow";

import type { OwnerId } from "../domain/owner/index.js";
import type { Pet } from "../domain/pet/index.js";
import type { PetId } from "../domain/pet/index.js";
import type { PetName } from "../domain/pet/index.js";
import type { PetSpecies } from "../domain/pet/index.js";
import type { PetByIdResolver } from "../domain/pet/index.js";
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
export type UseCaseInput = Readonly<{ actorUserId: UserId; petId: PetId }>;
export type UseCaseOk = Readonly<{ pet: PetView }>;
export type PetNotFound = Readonly<{ kind: "PetNotFound"; petId: PetId }>;
export type UseCaseError =
  UnauthorizedError | PetNotFound;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  petResolver: PetByIdResolver;
}>;
export type GetPetUseCase = Readonly<{
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
      .map((pet) => ({ pet: toView(pet) }));

export const GetPetUseCase = {
  create: (dependencies: Dependencies): GetPetUseCase => ({
    run: run(dependencies),
  }),
} as const;
