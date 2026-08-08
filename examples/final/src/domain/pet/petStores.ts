import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { PetCreated, PetDeleted, PetUpdated } from "./petEvent.js";

export type PetCreatedStore = AggregateStore<PetCreated>;
export type PetUpdatedStore = AggregateStore<PetUpdated>;
export type PetDeletedStore = AggregateStore<PetDeleted>;
