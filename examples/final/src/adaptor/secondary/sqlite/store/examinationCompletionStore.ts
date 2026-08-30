import { and, eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { AppointmentExaminationCompleted } from "../../../../domain/appointment/index.js";
import { AppointmentId } from "../../../../domain/appointment/index.js";
import type { AppointmentStoreError } from "../../../../domain/appointment/index.js";
import type { ExaminationCompletionStore } from "../../../../domain/examResult/index.js";
import type { ExamResultRecorded } from "../../../../domain/examResult/index.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import {
  appointmentsTable,
  domainEventsTable,
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

const toSafeExamState = (event: ExamResultRecorded) => ({
  examId: event.aggregateState.examId,
  petId: event.aggregateState.petId,
  collectedAt: event.aggregateState.collectedAt,
  needsFollowUp: event.aggregateState.needsFollowUp,
});

const toSafeAppointmentState = (
  event: AppointmentExaminationCompleted,
) => ({
  kind: event.aggregateState.kind,
  appointmentId: event.aggregateState.appointmentId,
  ownerId: event.aggregateState.ownerId,
  petId: event.aggregateState.petId,
  scheduledAt: event.aggregateState.scheduledAt,
  checkedInAt: event.aggregateState.checkedInAt,
  veterinarianId: event.aggregateState.veterinarianId,
  examinationStartedAt: event.aggregateState.examinationStartedAt,
  examId: event.aggregateState.examId,
  examinationCompletedAt: event.aggregateState.examinationCompletedAt,
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
          tx.insert(domainEventsTable)
            .values(
              toEventRecord(
                examResult,
                toSafeExamState(examResult),
                {
                  examId: examResult.aggregateId,
                  petId: examResult.aggregateState.petId,
                },
              ),
            )
            .run();
          tx.insert(domainEventsTable)
            .values(
              toEventRecord(
                appointment,
                toSafeAppointmentState(appointment),
                {
                  appointmentId: appointment.aggregateId,
                  examId: appointment.aggregateState.examId,
                },
              ),
            )
            .run();
        });
      }),
      (cause) => {
        const conflict = AppointmentConflictSchema.safeParse(cause);
        if (conflict.success) return conflict.data;
        throw cause;
      },
    ),
});
