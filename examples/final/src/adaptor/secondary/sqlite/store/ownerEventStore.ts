import { eq } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";

import type {
  OwnerCreated,
  OwnerDeleted,
  OwnerUpdated,
} from "../../../../domain/owner/index.js";
import type {
  OwnerDeletedStore,
  OwnerHasPetsStoreError,
  OwnerNotFoundStoreError,
} from "../../../../domain/owner/index.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { domainEventsTable, ownersTable, petsTable } from "../schema.js";

type OwnerProjectionEvent = OwnerCreated | OwnerUpdated;

const createOwnerProjectionEventStore = (db: SqliteDatabase) =>
  ({
    store: (...events: readonly OwnerProjectionEvent[]) =>
      ResultAsync.fromSafePromise(
        Promise.resolve().then(() =>
          db.transaction((tx) => {
            events.forEach((event) => {
              const state = event.aggregateState;
              const values = {
                ownerId: state.ownerId,
                name: state.name.unwrap(),
                email: state.email.unwrap(),
                phone: state.phone.unwrap(),
              };
              tx.insert(ownersTable)
                .values(values)
                .onConflictDoUpdate({
                  target: ownersTable.ownerId,
                  set: values,
                })
                .run();
              tx.insert(domainEventsTable)
                .values(
                  toEventRecord(
                    event,
                    { ownerId: state.ownerId },
                    { ownerId: state.ownerId },
                  ),
                )
                .run();
            });
          }),
        ),
      ),
  }) as const;

const ownerHasPets = (
  ownerId: OwnerDeleted["aggregateId"],
): OwnerHasPetsStoreError => ({
  kind: "OwnerHasPets",
  ownerId,
});
const ownerNotFound = (
  ownerId: OwnerDeleted["aggregateId"],
): OwnerNotFoundStoreError => ({ kind: "OwnerNotFound", ownerId });
export const createOwnerDeletedEventStore = (
  db: SqliteDatabase,
): OwnerDeletedStore => ({
  store: (event) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          const blockingPet = tx
            .select({ ownerId: petsTable.ownerId })
            .from(petsTable)
            .where(eq(petsTable.ownerId, event.aggregateId))
            .get();
          if (blockingPet !== undefined) {
            return err(ownerHasPets(event.aggregateId));
          }

          const result = tx
            .delete(ownersTable)
            .where(eq(ownersTable.ownerId, event.aggregateId))
            .run();
          if (result.changes !== 1) return err(ownerNotFound(event.aggregateId));

          tx.insert(domainEventsTable)
            .values(
              toEventRecord(event, undefined, { ownerId: event.aggregateId }),
            )
            .run();
          return ok(undefined);
        }),
      ),
    ).andThen((result) => result),
});

export const createOwnerEventStore = createOwnerProjectionEventStore;
