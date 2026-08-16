import { and, eq, inArray } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";

import type {
  PetCreated,
  PetDeleted,
  PetUpdated,
} from "../../../../domain/pet/petEvent.js";
import type {
  PetDeletedStore,
  PetHasActiveAppointmentStoreError,
  PetNotFoundStoreError,
} from "../../../../domain/pet/petStores.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { appointmentsTable, domainEventsTable, petsTable } from "../schema.js";

type PetProjectionEvent = PetCreated | PetUpdated;
const activeStatuses = [
  "Scheduled",
  "CheckedIn",
  "InExamination",
  "AwaitingPayment",
] as const;

const createPetProjectionEventStore = (db: SqliteDatabase) =>
  ({
    store: (...events: readonly PetProjectionEvent[]) =>
      ResultAsync.fromSafePromise(
        Promise.resolve().then(() =>
          db.transaction((tx) => {
            events.forEach((event) => {
              const state = event.aggregateState;
              const values = {
                petId: state.petId,
                ownerId: state.ownerId,
                name: state.name.unwrap(),
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
      ),
  }) as const;

const petHasActiveAppointment = (
  petId: PetDeleted["aggregateId"],
): PetHasActiveAppointmentStoreError => ({
  kind: "PetHasActiveAppointment",
  petId,
});
const petNotFound = (
  petId: PetDeleted["aggregateId"],
): PetNotFoundStoreError => ({ kind: "PetNotFound", petId });
export const createPetDeletedEventStore = (
  db: SqliteDatabase,
): PetDeletedStore => ({
  store: (event) =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          const blockingAppointment = tx
            .select({ petId: appointmentsTable.petId })
            .from(appointmentsTable)
            .where(
              and(
                eq(appointmentsTable.petId, event.aggregateId),
                inArray(appointmentsTable.status, activeStatuses),
              ),
            )
            .get();
          if (blockingAppointment !== undefined) {
            return err(petHasActiveAppointment(event.aggregateId));
          }

          const result = tx
            .delete(petsTable)
            .where(eq(petsTable.petId, event.aggregateId))
            .run();
          if (result.changes !== 1) return err(petNotFound(event.aggregateId));

          tx.insert(domainEventsTable)
            .values(
              toEventRecord(event, undefined, {
                petId: event.aggregateId,
                ownerId: event.eventPayload.ownerId,
              }),
            )
            .run();
          return ok(undefined);
        }),
      ),
    ).andThen((result) => result),
});

export const createPetEventStore = createPetProjectionEventStore;
