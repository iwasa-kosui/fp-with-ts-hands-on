import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { ResultAsync } from "neverthrow";
import type {
  UserCreated,
  UserDeleted,
  UserPasswordReset,
  UserUpdated,
} from "./userEvent.js";

export type UserCreatedStore = AggregateStore<UserCreated>;
export type UserPasswordResetStore = AggregateStore<UserPasswordReset>;
export type CannotDowngradeLastAdminStoreError = Readonly<{
  kind: "CannotDowngradeLastAdmin";
}>;
export type UserUpdatedStoreError =
  CannotDowngradeLastAdminStoreError | RepositoryError;
export type UserUpdatedStore = Readonly<{
  store: (
    ...events: readonly UserUpdated[]
  ) => ResultAsync<void, UserUpdatedStoreError>;
}>;
export type CannotDeleteLastAdminStoreError = Readonly<{
  kind: "CannotDeleteLastAdmin";
}>;
export type UserDeletedStoreError =
  CannotDeleteLastAdminStoreError | RepositoryError;
export type UserDeletedStore = Readonly<{
  store: (
    ...events: readonly UserDeleted[]
  ) => ResultAsync<void, UserDeletedStoreError>;
}>;
