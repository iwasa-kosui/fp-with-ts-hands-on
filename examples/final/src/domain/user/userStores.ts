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
export type UserUpdatedStore = AggregateStore<UserUpdated>;
export type UserPasswordResetStore = AggregateStore<UserPasswordReset>;
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
