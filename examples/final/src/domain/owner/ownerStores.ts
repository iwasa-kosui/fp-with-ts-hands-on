import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { ResultAsync } from "neverthrow";
import type { OwnerId } from "./ownerId.js";
import type { OwnerCreated, OwnerDeleted, OwnerUpdated } from "./ownerEvent.js";

export type OwnerCreatedStore = AggregateStore<OwnerCreated>;
export type OwnerUpdatedStore = AggregateStore<OwnerUpdated>;
export type OwnerHasPetsStoreError = Readonly<{
  kind: "OwnerHasPets";
  ownerId: OwnerId;
}>;
export type OwnerNotFoundStoreError = Readonly<{
  kind: "OwnerNotFound";
  ownerId: OwnerId;
}>;
export type OwnerDeletionConflictStoreError = Readonly<{
  kind: "OwnerDeletionConflict";
  ownerId: OwnerId;
}>;
export type OwnerDeletedStoreError =
  | OwnerHasPetsStoreError
  | OwnerNotFoundStoreError
  | OwnerDeletionConflictStoreError
  | RepositoryError;
export type OwnerDeletedStore = Readonly<{
  store: (
    ...events: readonly OwnerDeleted[]
  ) => ResultAsync<void, OwnerDeletedStoreError>;
}>;
