import { eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";

import type { ExamResultEvent } from "../../../../domain/examResult/index.js";
import { assertNever } from "../../../../domain/shared/assertNever.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { domainEventsTable, examResultsTable } from "../schema.js";

export const createExamResultEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly ExamResultEvent[]) =>
    ResultAsync.fromSafePromise(
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
                tx.insert(domainEventsTable)
                  .values(toEventRecord(
                    event,
                    {
                      examId: state.examId,
                      petId: state.petId,
                      collectedAt: state.collectedAt,
                      needsFollowUp: state.needsFollowUp,
                    },
                    { examId: state.examId, petId: state.petId },
                  ))
                  .run();
                return;
              }
              case "ExamResultDeleted":
                tx.delete(examResultsTable).where(eq(examResultsTable.examId, event.aggregateId)).run();
                tx.insert(domainEventsTable)
                  .values(toEventRecord(event, undefined, {
                    examId: event.aggregateId,
                    petId: event.eventPayload.petId,
                  }))
                  .run();
                return;
              default:
                return assertNever(event);
            }
          });
        }),
      ),
    ),
} as const);
