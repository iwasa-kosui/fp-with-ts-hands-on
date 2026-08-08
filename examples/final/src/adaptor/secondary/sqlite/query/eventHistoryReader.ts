import { asc } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type {
  EventHistoryEntry,
  EventHistoryReader,
} from "../../../../useCase/query/eventHistoryReader.js";
import type { SqliteDatabase } from "../db.js";
import { domainEventsTable } from "../schema.js";
import {
  parsePersistedEventRow,
  type PersistedEventRow,
} from "./persistedEventRow.js";

const toEntry = (row: PersistedEventRow): EventHistoryEntry => ({
  eventId: row.eventId,
  aggregateId: row.aggregateId,
  aggregateName: row.aggregateName,
  aggregateState: row.aggregateState ?? undefined,
  eventName: row.eventName,
  eventPayload: row.eventPayload,
  occurredAt: row.occurredAt,
  actorUserId: row.actorUserId,
});

export const createEventHistoryReader = (
  db: SqliteDatabase,
): EventHistoryReader => ({
  list: () =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db
          .select()
          .from(domainEventsTable)
          .orderBy(asc(domainEventsTable.occurredAt))
          .all()
          .map(parsePersistedEventRow)
          .map(toEntry),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "EventHistoryReader.list",
        cause,
      }),
    ),
});
