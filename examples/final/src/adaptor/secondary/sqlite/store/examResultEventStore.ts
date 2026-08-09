import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../../../../domain/aggregate/repositoryError.js";
import type { ExamResultEvent } from "../../../../domain/examResult/examResultEvent.js";
import { assertNever } from "../../../../domain/shared/assertNever.js";
import type { SqliteDatabase } from "../db.js";
import { persistDomainEvent } from "../eventPersistence.js";
import { examResultsTable } from "../schema.js";

export const createExamResultEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly ExamResultEvent[]) =>
    ResultAsync.fromPromise(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            switch (event.kind) {
              case "ExamResultRecorded":
              case "ExamResultUpdated": {
                const state = event.aggregateState;
                const values = {
                  examId: state.examId,
                  petId: state.petId,
                  state: {
                    ...state,
                    items: state.items.map((item) => item.unwrap()),
                  },
                };
                tx.insert(examResultsTable)
                  .values(values)
                  .onConflictDoUpdate({ target: examResultsTable.examId, set: values })
                  .run();
                persistDomainEvent(tx, event);
                return;
              }
              case "ExamResultDeleted":
                tx.delete(examResultsTable).where(eq(examResultsTable.examId, event.aggregateId)).run();
                persistDomainEvent(tx, event);
                return;
              default:
                return assertNever(event);
            }
          });
        }),
      ),
      (cause): RepositoryError => ({
        kind: "RepositoryError",
        operation: "ExamResultEventStore.store",
        cause,
      }),
    ),
} as const);
