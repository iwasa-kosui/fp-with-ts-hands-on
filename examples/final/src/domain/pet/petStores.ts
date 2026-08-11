import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { ResultAsync } from "neverthrow";
import type { PetId } from "./petId.js";
import type { PetCreated, PetDeleted, PetUpdated } from "./petEvent.js";

export type PetCreatedStore = AggregateStore<PetCreated>;
export type PetUpdatedStore = AggregateStore<PetUpdated>;
export type PetHasActiveAppointmentStoreError = Readonly<{
  kind: "PetHasActiveAppointment";
  petId: PetId;
}>;
export type PetNotFoundStoreError = Readonly<{
  kind: "PetNotFound";
  petId: PetId;
}>;
export type PetDeletedStoreError =
  | PetHasActiveAppointmentStoreError
  | PetNotFoundStoreError
  | RepositoryError;
export type PetDeletedStore = Readonly<{
  store: (event: PetDeleted) => ResultAsync<void, PetDeletedStoreError>;
}>;
