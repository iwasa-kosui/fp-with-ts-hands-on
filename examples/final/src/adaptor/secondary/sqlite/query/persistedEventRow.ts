import { z } from "zod";

import { EventId } from "../../../../domain/aggregate/eventId.js";
import { Timestamp } from "../../../../domain/aggregate/timestamp.js";
import { UserId } from "../../../../domain/user/userId.js";

const PersistedEventRowSchema = z.object({
  eventId: EventId.schema,
  aggregateId: z.string().min(1),
  aggregateName: z.string().min(1),
  eventName: z.string().min(1),
  occurredAt: Timestamp.schema,
  actorUserId: UserId.schema,
  payloadSensitivity: z.enum(["Regular", "Sensitive"]),
  regularAggregateState: z.unknown().nullable(),
  regularEventPayload: z.record(z.unknown()).nullable(),
}).strict();

export type PersistedEventRow = z.infer<typeof PersistedEventRowSchema>;

export const parsePersistedEventRow = (raw: unknown): PersistedEventRow => {
  const row = PersistedEventRowSchema.parse(raw);
  if (row.payloadSensitivity === "Regular" && row.regularEventPayload === null) {
    throw new TypeError("Corrupt regular domain event payload");
  }
  if (
    row.payloadSensitivity === "Sensitive" &&
    (row.regularAggregateState !== null || row.regularEventPayload !== null)
  ) {
    throw new TypeError("Sensitive domain event joined a regular payload");
  }
  return row;
};
