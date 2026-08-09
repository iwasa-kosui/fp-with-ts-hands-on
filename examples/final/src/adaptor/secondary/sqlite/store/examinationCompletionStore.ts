import { and, eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { AppointmentExaminationCompleted } from "../../../../domain/appointment/appointmentEvent.js";
import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import { AppointmentVersion } from "../../../../domain/appointment/appointmentVersion.js";
import type { AppointmentStoreError } from "../../../../domain/appointment/appointmentStores.js";
import type { ExaminationCompletionStore } from "../../../../domain/examResult/examResultStores.js";
import type { ExamResultRecorded } from "../../../../domain/examResult/examResultEvent.js";
import type { SqliteDatabase } from "../db.js";
import { persistDomainEvent } from "../eventPersistence.js";
import {
  appointmentsTable,
  examResultsTable,
} from "../schema.js";

const StaleAppointmentVersionSchema = z.object({
  kind: z.literal("StaleAppointmentVersion"),
  appointmentId: AppointmentId.schema,
  expectedVersion: AppointmentVersion.schema,
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
  scheduledAt: event.aggregateState.scheduledAt,
  durationMinutes: event.aggregateState.durationMinutes,
  serviceCode: event.aggregateState.serviceCode,
  bookingKind: event.aggregateState.bookingKind,
  assignedVeterinarianId: event.aggregateState.assignedVeterinarianId,
  receptionNote: event.aggregateState.receptionNote?.unwrap() ?? null,
  settlementStatus: event.aggregateState.settlement.kind,
  depositAmount: event.aggregateState.settlement.kind === "NoPayment"
    ? null
    : event.aggregateState.settlement.depositAmount,
  version: event.aggregateState.version,
  state: {
    ...event.aggregateState,
    visitReason: event.aggregateState.visitReason.unwrap(),
    receptionNote: event.aggregateState.receptionNote?.unwrap() ?? null,
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
          const previousVersion = AppointmentVersion.schema.parse(
            appointment.aggregateState.version - 1,
          );
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
                eq(appointmentsTable.version, previousVersion),
              ),
            )
            .run().changes;
          if (changes !== 1) {
            throw {
              kind: "StaleAppointmentVersion",
              appointmentId: appointment.aggregateId,
              expectedVersion: previousVersion,
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
        const stale = StaleAppointmentVersionSchema.safeParse(cause);
        return stale.success
          ? stale.data
          : {
              kind: "RepositoryError",
              operation: "ExaminationCompletionStore.store",
              cause,
            };
      },
    ),
});
