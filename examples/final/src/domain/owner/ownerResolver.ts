import type { ResultAsync } from "neverthrow";

import type { Owner } from "./owner.js";
import type { OwnerId } from "./ownerId.js";

export type OwnerByIdResolver = Readonly<{
  resolveById: (ownerId: OwnerId) => ResultAsync<Owner | undefined, never>;
}>;

export type OwnerListResolver = Readonly<{
  resolveAll: () => ResultAsync<readonly Owner[], never>;
}>;
