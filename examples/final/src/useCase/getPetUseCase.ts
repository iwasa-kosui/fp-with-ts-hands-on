import { err, ok, type Result, type ResultAsync } from "neverthrow";

import type { RepositoryError } from "../domain/aggregate/repositoryError.js";
import type { OwnerId } from "../domain/owner/ownerId.js";
import type { Pet } from "../domain/pet/pet.js";
import type { PetId } from "../domain/pet/petId.js";
import type { PetResolver } from "../domain/pet/petResolver.js";
import type { UserId } from "../domain/user/userId.js";
import type { UserResolver } from "../domain/user/userResolver.js";
import { ensureCanManageClinic } from "./authorization.js";
import { ensureUserFound, type UnauthorizedError } from "./errors.js";

export type PetView = Readonly<{
  petId: PetId;
  ownerId: OwnerId;
  name: string;
  species: string;
}>;
export type UseCaseInput = Readonly<{ actorUserId: UserId; petId: PetId }>;
export type UseCaseOk = Readonly<{ pet: PetView }>;
export type PetNotFound = Readonly<{ kind: "PetNotFound"; petId: PetId }>;
export type UseCaseRepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: string;
}>;
export type UseCaseError =
  UnauthorizedError | PetNotFound | UseCaseRepositoryError;
export type UseCaseOutput = ResultAsync<UseCaseOk, UseCaseError>;
export type Dependencies = Readonly<{
  userResolver: UserResolver;
  petResolver: PetResolver;
}>;
export type GetPetUseCase = Readonly<{
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
      .map((pet) => ({ pet: toView(pet) }));

export const GetPetUseCase = {
  create: (dependencies: Dependencies): GetPetUseCase => ({
    run: run(dependencies),
  }),
} as const;
