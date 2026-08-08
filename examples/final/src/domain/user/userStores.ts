import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { UserCreated, UserDeleted, UserPasswordReset, UserUpdated } from "./userEvent.js";

export type UserCreatedStore = AggregateStore<UserCreated>;
export type UserUpdatedStore = AggregateStore<UserUpdated>;
export type UserPasswordResetStore = AggregateStore<UserPasswordReset>;
export type UserDeletedStore = AggregateStore<UserDeleted>;
