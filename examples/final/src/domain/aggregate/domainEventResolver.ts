import type { ResultAsync } from "neverthrow";
import type { AnyDomainEvent } from "./domainEvent.js";
import type { RepositoryError } from "./repositoryError.js";

export type DomainEventResolver = Readonly<{
  resolveAll: () => ResultAsync<readonly AnyDomainEvent[], RepositoryError>;
}>;
