import { asc, eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type {
  AuditEventSummary,
  EventHistoryReader,
} from "../../../../useCase/query/eventHistoryReader.js";
import type { SqliteDatabase } from "../db.js";
import {
  domainEventPayloadsTable,
  domainEventsTable,
} from "../schema.js";
import {
  parsePersistedEventRow,
  type PersistedEventRow,
} from "./persistedEventRow.js";

const toAuditEventSummary = (
  row: PersistedEventRow,
): AuditEventSummary => {
  const metadata = {
    eventId: row.eventId,
    aggregateId: row.aggregateId,
    aggregateName: row.aggregateName,
    eventName: row.eventName,
    occurredAt: row.occurredAt,
    actorUserId: row.actorUserId,
    payloadSensitivity: row.payloadSensitivity,
  };
  return row.payloadSensitivity === "Regular"
    ? {
        ...metadata,
        regularPayload: {
          aggregateState: row.regularAggregateState,
          eventPayload: row.regularEventPayload ?? {},
        },
      }
    : metadata;
};

export const createEventHistoryReader = (
  db: SqliteDatabase,
): EventHistoryReader => ({
  list: (_admin) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db
          .select({
            eventId: domainEventsTable.eventId,
            aggregateId: domainEventsTable.aggregateId,
            aggregateName: domainEventsTable.aggregateName,
            eventName: domainEventsTable.eventName,
            occurredAt: domainEventsTable.occurredAt,
            actorUserId: domainEventsTable.actorUserId,
            payloadSensitivity: domainEventsTable.payloadSensitivity,
            regularAggregateState: domainEventPayloadsTable.aggregateState,
            regularEventPayload: domainEventPayloadsTable.eventPayload,
          })
          .from(domainEventsTable)
          .leftJoin(
            domainEventPayloadsTable,
            eq(domainEventPayloadsTable.eventId, domainEventsTable.eventId),
          )
          .orderBy(asc(domainEventsTable.occurredAt))
          .all()
          .map(parsePersistedEventRow)
          .map(toAuditEventSummary),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "EventHistoryReader.list",
        cause,
      }),
    ),
});
