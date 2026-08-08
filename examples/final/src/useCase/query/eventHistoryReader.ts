import type { ResultAsync } from "neverthrow";

import type { EventId } from "../../domain/aggregate/eventId.js";
import type { RepositoryError } from "../../domain/aggregate/repositoryError.js";
import type { Timestamp } from "../../domain/aggregate/timestamp.js";
import type { UserId } from "../../domain/user/userId.js";

export type EventHistoryEntry = Readonly<{
  eventId: EventId;
  aggregateId: string;
  aggregateName: string;
  eventName: string;
  occurredAt: Timestamp;
  actorUserId: UserId;
  aggregateState: Readonly<Record<string, unknown>> | undefined;
  eventPayload: Readonly<Record<string, unknown>>;
}>;

export type EventHistoryReader = Readonly<{
  list: () => ResultAsync<readonly EventHistoryEntry[], RepositoryError>;
}>;
