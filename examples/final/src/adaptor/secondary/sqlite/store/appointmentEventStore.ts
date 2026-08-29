import { and, eq, or } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { Appointment } from "../../../../domain/appointment/index.js";
import type { AppointmentEvent } from "../../../../domain/appointment/index.js";
import type { AppointmentStoreError } from "../../../../domain/appointment/index.js";
import { AppointmentId } from "../../../../domain/appointment/index.js";
import { assertNever } from "../../../../domain/shared/assertNever.js";
import type { SqliteDatabase } from "../db.js";
import { toEventRecord } from "../eventRecord.js";
import { appointmentsTable, domainEventsTable } from "../schema.js";

type AppointmentProjectionEvent = Exclude<
  AppointmentEvent,
  { kind: "AppointmentExaminationCompleted" }
>;

const safeState = (state: Appointment): Readonly<Record<string, unknown>> => {
  const base = {
    kind: state.kind,
    appointmentId: state.appointmentId,
    ownerId: state.ownerId,
    petId: state.petId,
    scheduledAt: state.scheduledAt,
  };

  switch (state.kind) {
    case "Scheduled":
      return base;
    case "CheckedIn":
      return { ...base, checkedInAt: state.checkedInAt };
    case "InExamination":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
      };
    case "AwaitingPayment":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
        examId: state.examId,
        examinationCompletedAt: state.examinationCompletedAt,
      };
    case "Paid":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
        examId: state.examId,
        examinationCompletedAt: state.examinationCompletedAt,
        amount: state.amount,
        paidAt: state.paidAt,
      };
    case "Canceled":
      return { ...base, canceledAt: state.canceledAt };
    default:
      return assertNever(state);
  }
};

const safePayload = (
  event: AppointmentProjectionEvent,
): Readonly<Record<string, unknown>> => {
  switch (event.kind) {
    case "ExaminationStarted":
      return {
        appointmentId: event.aggregateId,
        veterinarianId: event.aggregateState.veterinarianId,
      };
    case "AppointmentBooked":
    case "AppointmentCheckedIn":
    case "PaymentRecorded":
    case "AppointmentCanceled":
      return { appointmentId: event.aggregateId };
    default:
      return assertNever(event);
  }
};

const projectionState = (state: Appointment): Readonly<Record<string, unknown>> => {
  const base = {
    kind: state.kind,
    appointmentId: state.appointmentId,
    ownerId: state.ownerId,
    petId: state.petId,
    scheduledAt: state.scheduledAt,
    reason: state.reason.unwrap(),
  };
  switch (state.kind) {
    case "Scheduled":
      return base;
    case "CheckedIn":
      return { ...base, checkedInAt: state.checkedInAt };
    case "InExamination":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
      };
    case "AwaitingPayment":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
        examId: state.examId,
        examinationCompletedAt: state.examinationCompletedAt,
      };
    case "Paid":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        veterinarianId: state.veterinarianId,
        examinationStartedAt: state.examinationStartedAt,
        examId: state.examId,
        examinationCompletedAt: state.examinationCompletedAt,
        diagnosis: state.diagnosis.unwrap(),
        treatment: state.treatment.unwrap(),
        amount: state.amount,
        paidAt: state.paidAt,
      };
    case "Canceled":
      return { ...base, canceledAt: state.canceledAt };
    default:
      return assertNever(state);
  }
};
const AppointmentConflictSchema = z.object({
  kind: z.literal("AppointmentConflict"),
  appointmentId: AppointmentId.schema,
});

export const createAppointmentEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly AppointmentProjectionEvent[]) =>
    ResultAsync.fromPromise<void, AppointmentStoreError>(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            const state = event.aggregateState;
            const values = {
              appointmentId: state.appointmentId,
              status: state.kind,
              ownerId: state.ownerId,
              petId: state.petId,
              state: projectionState(state),
            };
            const changes = (() => {
              switch (event.kind) {
                case "AppointmentBooked":
                  return tx.insert(appointmentsTable)
                    .values(values)
                    .onConflictDoNothing({ target: appointmentsTable.appointmentId })
                    .run().changes;
                case "AppointmentCheckedIn":
                  return tx.update(appointmentsTable)
                    .set(values)
                    .where(and(
                      eq(appointmentsTable.appointmentId, state.appointmentId),
                      eq(appointmentsTable.status, "Scheduled"),
                    ))
                    .run().changes;
                case "ExaminationStarted":
                  return tx.update(appointmentsTable)
                    .set(values)
                    .where(and(
                      eq(appointmentsTable.appointmentId, state.appointmentId),
                      eq(appointmentsTable.status, "CheckedIn"),
                    ))
                    .run().changes;
                case "PaymentRecorded":
                  return tx.update(appointmentsTable)
                    .set(values)
                    .where(and(
                      eq(appointmentsTable.appointmentId, state.appointmentId),
                      eq(appointmentsTable.status, "AwaitingPayment"),
                    ))
                    .run().changes;
                case "AppointmentCanceled":
                  return tx.update(appointmentsTable)
                    .set(values)
                    .where(and(
                      eq(appointmentsTable.appointmentId, state.appointmentId),
                      or(
                        eq(appointmentsTable.status, "Scheduled"),
                        eq(appointmentsTable.status, "CheckedIn"),
                      ),
                    ))
                    .run().changes;
                default:
                  return assertNever(event);
              }
            })();
            if (changes !== 1) {
              throw {
                kind: "AppointmentConflict",
                appointmentId: event.aggregateId,
              } as const;
            }
            tx.insert(domainEventsTable)
              .values(toEventRecord(
                event,
                safeState(state),
                safePayload(event),
              ))
              .run();
          });
        }),
      ),
      (cause): AppointmentStoreError => {
        const conflict = AppointmentConflictSchema.safeParse(cause);
        if (conflict.success) return conflict.data;
        throw cause;
      },
    ),
} as const);
