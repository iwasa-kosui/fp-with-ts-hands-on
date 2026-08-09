import { and, eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { AppointmentExaminationCompleted } from "../../../../domain/appointment/appointmentEvent.js";
import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import type { AppointmentStoreError } from "../../../../domain/appointment/appointmentStores.js";
import type { ExaminationCompletionStore } from "../../../../domain/examResult/examResultStores.js";
import type { ExamResultRecorded } from "../../../../domain/examResult/examResultEvent.js";
import type { SqliteDatabase } from "../db.js";
import { persistDomainEvent } from "../eventPersistence.js";
import {
  appointmentsTable,
  examResultsTable,
} from "../schema.js";

const AppointmentConflictSchema = z.object({
  kind: z.literal("AppointmentConflict"),
  appointmentId: AppointmentId.schema,
});

const ensureMatchingEvents = (
  examResult: ExamResultRecorded,
  appointment: AppointmentExaminationCompleted,
): void => {
  if (
    examResult.aggregateId !== appointment.aggregateState.examId ||
    examResult.aggregateState.petId !== appointment.aggregateState.petId ||
    examResult.actorUserId !== appointment.actorUserId ||
    examResult.eventId === appointment.eventId
  ) {
    throw new TypeError("Mismatched examination completion events");
  }
};

const toExamResultValues = (event: ExamResultRecorded) => ({
  examId: event.aggregateState.examId,
  petId: event.aggregateState.petId,
  state: {
    ...event.aggregateState,
    items: event.aggregateState.items.map((item) => item.unwrap()),
  },
});

const toAppointmentValues = (event: AppointmentExaminationCompleted) => ({
  appointmentId: event.aggregateState.appointmentId,
  status: event.aggregateState.kind,
  ownerId: event.aggregateState.ownerId,
  petId: event.aggregateState.petId,
  state: {
    ...event.aggregateState,
    reason: event.aggregateState.reason.unwrap(),
  },
});

export const createExaminationCompletionStore = (
  db: SqliteDatabase,
): ExaminationCompletionStore => ({
  store: (examResult, appointment) =>
    ResultAsync.fromPromise<void, AppointmentStoreError>(
      Promise.resolve().then(() => {
        ensureMatchingEvents(examResult, appointment);
        return db.transaction((tx) => {
          const changes = tx
            .update(appointmentsTable)
            .set(toAppointmentValues(appointment))
            .where(
              and(
                eq(
                  appointmentsTable.appointmentId,
                  appointment.aggregateId,
                ),
                eq(appointmentsTable.status, "InExamination"),
              ),
            )
            .run().changes;
          if (changes !== 1) {
            throw {
              kind: "AppointmentConflict",
              appointmentId: appointment.aggregateId,
            };
          }

          tx.insert(examResultsTable)
            .values(toExamResultValues(examResult))
            .run();
          persistDomainEvent(tx, examResult);
          persistDomainEvent(tx, appointment);
        });
      }),
      (cause) => {
        const conflict = AppointmentConflictSchema.safeParse(cause);
        return conflict.success
          ? conflict.data
          : {
              kind: "RepositoryError",
              operation: "ExaminationCompletionStore.store",
              cause,
            };
      },
    ),
});
