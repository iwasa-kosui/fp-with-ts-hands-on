import type { ResultAsync } from "neverthrow";

import type { EventId } from "../../domain/aggregate/eventId.js";
import type { Timestamp } from "../../domain/aggregate/timestamp.js";
import type { Admin } from "../../domain/user/user.js";
import type { UserId } from "../../domain/user/userId.js";

export type SanitizedAuditValue = string | number | boolean | null;
export type SanitizedAuditRecord = Readonly<{
  eventId: EventId;
  aggregateId: string;
  aggregateName: string;
  eventName: string;
  occurredAt: Timestamp;
  actorUserId: UserId;
  aggregateState:
    | Readonly<Record<string, SanitizedAuditValue>>
    | undefined;
  eventPayload: Readonly<Record<string, SanitizedAuditValue>>;
}>;

export type EventHistoryReader = Readonly<{
  list: (
    admin: Admin,
  ) => ResultAsync<readonly SanitizedAuditRecord[], never>;
}>;
