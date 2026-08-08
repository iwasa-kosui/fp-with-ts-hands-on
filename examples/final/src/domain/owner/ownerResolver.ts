import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { Owner } from "./owner.js";
import type { OwnerId } from "./ownerId.js";

export type OwnerResolver = Readonly<{
  resolveById: (ownerId: OwnerId) => ResultAsync<Owner | undefined, RepositoryError>;
  resolveAll: () => ResultAsync<readonly Owner[], RepositoryError>;
}>;
