import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { OwnerId } from "../owner/ownerId.js";
import type { Pet } from "./pet.js";
import type { PetId } from "./petId.js";

export type PetResolver = Readonly<{
  resolveById: (petId: PetId) => ResultAsync<Pet | undefined, RepositoryError>;
  resolveByOwnerId: (ownerId: OwnerId) => ResultAsync<readonly Pet[], RepositoryError>;
  resolveAll: () => ResultAsync<readonly Pet[], RepositoryError>;
}>;
