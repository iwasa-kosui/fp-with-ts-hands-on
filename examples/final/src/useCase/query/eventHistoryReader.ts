import type { ResultAsync } from "neverthrow";

import type { EventId } from "../../domain/aggregate/eventId.js";
import type { RepositoryError } from "../../domain/aggregate/repositoryError.js";
import type { Timestamp } from "../../domain/aggregate/timestamp.js";
import type { Admin } from "../../domain/user/user.js";
import type { UserId } from "../../domain/user/userId.js";

export type PayloadSensitivity = "Regular" | "Sensitive";
export type AuditEventSummary = Readonly<{
  eventId: EventId;
  aggregateId: string;
  aggregateName: string;
  eventName: string;
  occurredAt: Timestamp;
  actorUserId: UserId;
  payloadSensitivity: PayloadSensitivity;
  regularPayload?: Readonly<{
    aggregateState: unknown | null;
    eventPayload: Readonly<Record<string, unknown>>;
  }>;
}>;

export type EventHistoryReader = Readonly<{
  list: (
    admin: Admin,
  ) => ResultAsync<readonly AuditEventSummary[], RepositoryError>;
}>;
