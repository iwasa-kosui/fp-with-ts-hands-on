import { and, eq, inArray } from "drizzle-orm";
import { err, errAsync, ok, ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type {
  PetCreated,
  PetDeleted,
  PetUpdated,
} from "../../../../domain/pet/petEvent.js";
import type {
  PetDeletedStore,
  PetHasActiveAppointmentStoreError,
} from "../../../../domain/pet/petStores.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { appointmentsTable, domainEventsTable, petsTable } from "../schema.js";

type PetProjectionEvent = PetCreated | PetUpdated;
type PetEvent = PetProjectionEvent | PetDeleted;
const activeStatuses = ["Scheduled", "CheckedIn", "InExamination"] as const;

const repositoryError =
  (operation: string) =>
  (cause: unknown): RepositoryError => ({
    kind: "RepositoryError",
    operation,
    cause,
  });

const createPetProjectionEventStore = (db: SqliteDatabase) =>
  ({
    store: (...events: readonly PetProjectionEvent[]) =>
      ResultAsync.fromPromise(
        Promise.resolve().then(() =>
          db.transaction((tx) => {
            events.forEach((event) => {
              const state = event.aggregateState;
              const values = {
                petId: state.petId,
                ownerId: state.ownerId,
                name: state.name,
                species: state.species,
              };
              tx.insert(petsTable)
                .values(values)
                .onConflictDoUpdate({ target: petsTable.petId, set: values })
                .run();
              tx.insert(domainEventsTable)
                .values(
                  toEventRecord(
                    event,
                    {
                      petId: state.petId,
                      ownerId: state.ownerId,
                      species: state.species,
                    },
                    { petId: state.petId, ownerId: state.ownerId },
                  ),
                )
                .run();
            });
          }),
        ),
        repositoryError("PetEventStore.store"),
      ),
  }) as const;

const petHasActiveAppointment = (
  petId: PetDeleted["aggregateId"],
): PetHasActiveAppointmentStoreError => ({
  kind: "PetHasActiveAppointment",
  petId,
});

export const createPetDeletedEventStore = (
  db: SqliteDatabase,
): PetDeletedStore => ({
  store: (...events) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          const petIds = events.map(({ aggregateId }) => aggregateId);
          const blockingAppointment =
            petIds.length === 0
              ? undefined
              : tx
                  .select({ petId: appointmentsTable.petId })
                  .from(appointmentsTable)
                  .where(
                    and(
                      inArray(appointmentsTable.petId, petIds),
                      inArray(appointmentsTable.status, activeStatuses),
                    ),
                  )
                  .get();
          if (blockingAppointment !== undefined) {
            const blockedEvent = events.find(
              ({ aggregateId }) => aggregateId === blockingAppointment.petId,
            );
            if (blockedEvent !== undefined) {
              return err(petHasActiveAppointment(blockedEvent.aggregateId));
            }
          }

          events.forEach((event) => {
            tx.delete(petsTable)
              .where(eq(petsTable.petId, event.aggregateId))
              .run();
            tx.insert(domainEventsTable)
              .values(
                toEventRecord(event, undefined, {
                  petId: event.aggregateId,
                  ownerId: event.eventPayload.ownerId,
                }),
              )
              .run();
          });
          return ok(undefined);
        }),
      ),
      repositoryError("PetDeletedEventStore.store"),
    ).andThen((result) => result),
});

const mixedEventKindsError = (): RepositoryError => ({
  kind: "RepositoryError",
  operation: "PetEventStore.store",
  cause: new TypeError(
    "Pet deletion events require an isolated guarded transaction",
  ),
});

export const createPetEventStore = (db: SqliteDatabase) => {
  const projectionStore = createPetProjectionEventStore(db);
  const deletionStore = createPetDeletedEventStore(db);

  function store(
    ...events: readonly PetProjectionEvent[]
  ): ReturnType<typeof projectionStore.store>;
  function store(
    ...events: readonly PetDeleted[]
  ): ReturnType<typeof deletionStore.store>;
  function store(...events: readonly PetEvent[]) {
    const deletionEvents = events.filter(
      (event) => event.kind === "PetDeleted",
    );
    const projectionEvents = events.filter(
      (event) => event.kind !== "PetDeleted",
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
