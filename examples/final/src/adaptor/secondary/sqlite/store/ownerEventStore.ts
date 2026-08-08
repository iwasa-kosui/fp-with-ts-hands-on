import { eq, inArray } from "drizzle-orm";
import { err, errAsync, ok, ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type {
  OwnerCreated,
  OwnerDeleted,
  OwnerUpdated,
} from "../../../../domain/owner/ownerEvent.js";
import type {
  OwnerDeletedStore,
  OwnerHasPetsStoreError,
} from "../../../../domain/owner/ownerStores.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { domainEventsTable, ownersTable, petsTable } from "../schema.js";

type OwnerProjectionEvent = OwnerCreated | OwnerUpdated;
type OwnerEvent = OwnerProjectionEvent | OwnerDeleted;

const repositoryError =
  (operation: string) =>
  (cause: unknown): RepositoryError => ({
    kind: "RepositoryError",
    operation,
    cause,
  });

const createOwnerProjectionEventStore = (db: SqliteDatabase) =>
  ({
    store: (...events: readonly OwnerProjectionEvent[]) =>
      ResultAsync.fromPromise(
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
        repositoryError("OwnerEventStore.store"),
      ),
  }) as const;

const ownerHasPets = (
  ownerId: OwnerDeleted["aggregateId"],
): OwnerHasPetsStoreError => ({
  kind: "OwnerHasPets",
  ownerId,
});

export const createOwnerDeletedEventStore = (
  db: SqliteDatabase,
): OwnerDeletedStore => ({
  store: (...events) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          const ownerIds = events.map(({ aggregateId }) => aggregateId);
          const blockingPet =
            ownerIds.length === 0
              ? undefined
              : tx
                  .select({ ownerId: petsTable.ownerId })
                  .from(petsTable)
                  .where(inArray(petsTable.ownerId, ownerIds))
                  .get();
          if (blockingPet !== undefined) {
            const blockedEvent = events.find(
              ({ aggregateId }) => aggregateId === blockingPet.ownerId,
            );
            if (blockedEvent !== undefined) {
              return err(ownerHasPets(blockedEvent.aggregateId));
            }
          }

          events.forEach((event) => {
            tx.delete(ownersTable)
              .where(eq(ownersTable.ownerId, event.aggregateId))
              .run();
            tx.insert(domainEventsTable)
              .values(
                toEventRecord(event, undefined, { ownerId: event.aggregateId }),
              )
              .run();
          });
          return ok(undefined);
        }),
      ),
      repositoryError("OwnerDeletedEventStore.store"),
    ).andThen((result) => result),
});

const mixedEventKindsError = (): RepositoryError => ({
  kind: "RepositoryError",
  operation: "OwnerEventStore.store",
  cause: new TypeError(
    "Owner deletion events require an isolated guarded transaction",
  ),
});

export const createOwnerEventStore = (db: SqliteDatabase) => {
  const projectionStore = createOwnerProjectionEventStore(db);
  const deletionStore = createOwnerDeletedEventStore(db);

  function store(
    ...events: readonly OwnerProjectionEvent[]
  ): ReturnType<typeof projectionStore.store>;
  function store(
    ...events: readonly OwnerDeleted[]
  ): ReturnType<typeof deletionStore.store>;
  function store(...events: readonly OwnerEvent[]) {
    const deletionEvents = events.filter(
      (event) => event.kind === "OwnerDeleted",
    );
    const projectionEvents = events.filter(
      (event) => event.kind !== "OwnerDeleted",
    );
    if (deletionEvents.length > 0 && projectionEvents.length > 0) {
      return errAsync(mixedEventKindsError());
    }
    return deletionEvents.length > 0
      ? deletionStore.store(...deletionEvents)
      : projectionStore.store(...projectionEvents);
  }

  return { store } as const;
};
