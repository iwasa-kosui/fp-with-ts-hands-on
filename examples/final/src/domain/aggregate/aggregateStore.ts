import type { ResultAsync } from "neverthrow";
import type { AnyDomainEvent } from "./domainEvent.js";
import type { RepositoryError } from "./repositoryError.js";

export type AggregateStore<TEvent extends AnyDomainEvent> = Readonly<{
  store: (...events: readonly TEvent[]) => ResultAsync<void, RepositoryError>;
}>;
