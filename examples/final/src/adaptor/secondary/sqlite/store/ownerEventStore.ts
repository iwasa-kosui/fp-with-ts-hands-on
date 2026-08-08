import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type { OwnerEvent } from "../../../../domain/owner/ownerEvent.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { domainEventsTable, ownersTable } from "../schema.js";

export const createOwnerEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly OwnerEvent[]) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            switch (event.kind) {
              case "OwnerCreated":
              case "OwnerUpdated": {
                const state = event.aggregateState;
                const values = {
                  ownerId: state.ownerId,
                  name: state.name.unwrap(),
                  email: state.email.unwrap(),
                  phone: state.phone.unwrap(),
                };
                tx.insert(ownersTable)
                  .values(values)
                  .onConflictDoUpdate({ target: ownersTable.ownerId, set: values })
                  .run();
                tx.insert(domainEventsTable)
                  .values(toEventRecord(
                    event,
                    { ownerId: state.ownerId },
                    { ownerId: state.ownerId },
                  ))
                  .run();
                return;
              }
              case "OwnerDeleted":
                tx.delete(ownersTable).where(eq(ownersTable.ownerId, event.aggregateId)).run();
                tx.insert(domainEventsTable)
                  .values(toEventRecord(event, undefined, { ownerId: event.aggregateId }))
                  .run();
                return;
              default:
                event satisfies never;
            }
          });
        }),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "OwnerEventStore.store",
        cause,
      }),
    ),
} as const);
