import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type { FollowUpRequested } from "../../../../domain/followUp/followUpRequested.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { domainEventsTable } from "../schema.js";

export const createFollowUpEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly FollowUpRequested[]) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            tx.insert(domainEventsTable)
              .values(toEventRecord(event, undefined, {
                appointmentId: event.aggregateId,
                petId: event.eventPayload.petId,
              }))
              .run();
          });
        }),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "FollowUpEventStore.store",
        cause,
      }),
    ),
} as const);
