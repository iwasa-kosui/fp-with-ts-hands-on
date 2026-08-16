import type { ResultAsync } from "neverthrow";

import type { OwnerId } from "../domain/owner/ownerId.js";
import type { Pet } from "../domain/pet/pet.js";
import type { PetId } from "../domain/pet/petId.js";
import type { PetName } from "../domain/pet/petName.js";
import type { PetSpecies } from "../domain/pet/petSpecies.js";
import type { PetListResolver } from "../domain/pet/petResolver.js";
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
export type UseCaseInput = Readonly<{ actorUserId: UserId }>;
export type UseCaseOk = Readonly<{ pets: readonly PetView[] }>;
export type UseCaseError = UnauthorizedError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserByIdResolver;
  petResolver: PetListResolver;
}>;
export type ListPetsUseCase = Readonly<{
  run: (input: UseCaseInput) => UseCaseOutput;
}>;

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
        dependencies.petResolver.resolveAll(),
      )
      .map((pets) => ({ pets: pets.map(toView) }));

export const ListPetsUseCase = {
  create: (dependencies: Dependencies): ListPetsUseCase => ({
    run: run(dependencies),
  }),
} as const;
