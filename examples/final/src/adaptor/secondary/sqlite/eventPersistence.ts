import type { AnyDomainEvent } from "../../../domain/aggregate/domainEvent.js";
import type { SqliteDatabase } from "./db.js";
import {
  classifyPayloadSensitivity,
  toEventRecord,
  type PayloadSensitivity,
} from "./eventRecord.js";
import {
  domainEventPayloadsTable,
  domainEventSensitivePayloadsTable,
  domainEventsTable,
} from "./schema.js";

type SqliteTransaction = Parameters<
  Parameters<SqliteDatabase["transaction"]>[0]
>[0];

export { classifyPayloadSensitivity, type PayloadSensitivity };

export const persistDomainEvent = (
  tx: SqliteTransaction,
  event: AnyDomainEvent,
): void => {
  const record = toEventRecord(event);
  tx.insert(domainEventsTable).values(record.metadata).run();
  const payload = {
    eventId: record.metadata.eventId,
    aggregateState: record.aggregateState,
    eventPayload: record.eventPayload,
  };
  if (record.metadata.payloadSensitivity === "Regular") {
    tx.insert(domainEventPayloadsTable).values(payload).run();
    return;
  }
  tx.insert(domainEventSensitivePayloadsTable).values(payload).run();
};
