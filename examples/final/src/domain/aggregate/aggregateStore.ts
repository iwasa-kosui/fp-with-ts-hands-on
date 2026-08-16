import type { ResultAsync } from "neverthrow";
import type { AnyDomainEvent } from "./domainEvent.js";

export type AggregateStore<TEvent extends AnyDomainEvent> = Readonly<{
  store: (...events: readonly TEvent[]) => ResultAsync<void, never>;
}>;
