import type { AggregateStore } from "../aggregate/aggregateStore.js";
import type { FollowUpRequested } from "./followUpRequested.js";

export type FollowUpRequestedStore = AggregateStore<FollowUpRequested>;
