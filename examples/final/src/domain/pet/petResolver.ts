import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { OwnerId } from "../owner/ownerId.js";
import type { Pet } from "./pet.js";
import type { PetId } from "./petId.js";

export type PetByIdResolver = Readonly<{
  resolveById: (petId: PetId) => ResultAsync<Pet | undefined, RepositoryError>;
}>;

export type PetByOwnerIdResolver = Readonly<{
  resolveByOwnerId: (ownerId: OwnerId) => ResultAsync<readonly Pet[], RepositoryError>;
}>;

export type PetListResolver = Readonly<{
  resolveAll: () => ResultAsync<readonly Pet[], RepositoryError>;
}>;
