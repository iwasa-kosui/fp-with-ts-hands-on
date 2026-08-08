import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { OwnerCreated, OwnerDeleted, OwnerUpdated } from "./ownerEvent.js";

export type OwnerCreatedStore = AggregateStore<OwnerCreated>;
export type OwnerUpdatedStore = AggregateStore<OwnerUpdated>;
export type OwnerDeletedStore = AggregateStore<OwnerDeleted>;
