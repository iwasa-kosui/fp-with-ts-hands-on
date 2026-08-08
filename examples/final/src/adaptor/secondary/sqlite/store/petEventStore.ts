import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type { PetEvent } from "../../../../domain/pet/petEvent.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { domainEventsTable, petsTable } from "../schema.js";

export const createPetEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly PetEvent[]) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            switch (event.kind) {
              case "PetCreated":
              case "PetUpdated": {
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
                  .values(toEventRecord(
                    event,
                    {
                      petId: state.petId,
                      ownerId: state.ownerId,
                      species: state.species,
                    },
                    { petId: state.petId, ownerId: state.ownerId },
                  ))
                  .run();
                return;
              }
              case "PetDeleted":
                tx.delete(petsTable).where(eq(petsTable.petId, event.aggregateId)).run();
                tx.insert(domainEventsTable)
                  .values(toEventRecord(event, undefined, {
                    petId: event.aggregateId,
                    ownerId: event.eventPayload.ownerId,
                  }))
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
        operation: "PetEventStore.store",
        cause,
      }),
    ),
} as const);
