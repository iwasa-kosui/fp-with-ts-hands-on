import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { SessionCreated, SessionDeleted } from "./sessionEvent.js";

export type SessionCreatedStore = AggregateStore<SessionCreated>;
export type SessionDeletedStore = AggregateStore<SessionDeleted>;
