import type { ResultAsync } from "neverthrow";

import type { OwnerId } from "../owner/index.js";
import type { Pet } from "./pet.js";
import type { PetId } from "./petId.js";

export type PetByIdResolver = Readonly<{
  resolveById: (petId: PetId) => ResultAsync<Pet | undefined, never>;
}>;

export type PetByOwnerIdResolver = Readonly<{
  resolveByOwnerId: (ownerId: OwnerId) => ResultAsync<readonly Pet[], never>;
}>;

export type PetListResolver = Readonly<{
  resolveAll: () => ResultAsync<readonly Pet[], never>;
}>;
