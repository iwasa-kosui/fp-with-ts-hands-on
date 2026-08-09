import { and, eq, or } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import type { Appointment } from "../../../../domain/appointment/appointment.js";
import type { AppointmentEvent } from "../../../../domain/appointment/appointmentEvent.js";
import type { AppointmentStoreError } from "../../../../domain/appointment/appointmentStores.js";
import { AppointmentId } from "../../../../domain/appointment/appointmentId.js";
import { AppointmentVersion } from "../../../../domain/appointment/appointmentVersion.js";
import { assertNever } from "../../../../domain/shared/assertNever.js";
import type { SqliteDatabase } from "../db.js";
import { persistDomainEvent } from "../eventPersistence.js";
import { appointmentsTable } from "../schema.js";

type AppointmentProjectionEvent = Exclude<
  AppointmentEvent,
  { kind: "AppointmentExaminationCompleted" }
>;

const projectionState = (state: Appointment): Readonly<Record<string, unknown>> => {
  const base = {
    kind: state.kind,
    appointmentId: state.appointmentId,
    ownerId: state.ownerId,
    petId: state.petId,
    scheduledAt: state.scheduledAt,
    durationMinutes: state.durationMinutes,
    serviceCode: state.serviceCode,
    bookingKind: state.bookingKind,
    assignedVeterinarianId: state.assignedVeterinarianId,
    visitReason: state.visitReason.unwrap(),
    receptionNote: state.receptionNote?.unwrap() ?? null,
    settlement: state.settlement,
    version: state.version,
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
        examinationStartedAt: state.examinationStartedAt,
      };
    case "AwaitingPayment":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        examinationStartedAt: state.examinationStartedAt,
        examId: state.examId,
        examinationCompletedAt: state.examinationCompletedAt,
      };
    case "Paid":
      return {
        ...base,
        checkedInAt: state.checkedInAt,
        examinationStartedAt: state.examinationStartedAt,
        examId: state.examId,
        examinationCompletedAt: state.examinationCompletedAt,
        diagnosis: state.diagnosis.unwrap(),
        treatment: state.treatment.unwrap(),
      };
    case "Canceled":
      return {
        ...base,
        cancellationReason: state.cancellationReason.unwrap(),
        canceledAt: state.canceledAt,
      };
    default:
      return assertNever(state);
  }
};
const StaleAppointmentVersionSchema = z.object({
  kind: z.literal("StaleAppointmentVersion"),
  appointmentId: AppointmentId.schema,
  expectedVersion: AppointmentVersion.schema,
});

const depositAmountOf = (state: Appointment): number | null =>
  state.settlement.kind === "NoPayment" ? null : state.settlement.depositAmount;

const toAppointmentValues = (state: Appointment) => ({
  appointmentId: state.appointmentId,
  status: state.kind,
  ownerId: state.ownerId,
  petId: state.petId,
  scheduledAt: state.scheduledAt,
  durationMinutes: state.durationMinutes,
  serviceCode: state.serviceCode,
  bookingKind: state.bookingKind,
  assignedVeterinarianId: state.assignedVeterinarianId,
  receptionNote: state.receptionNote?.unwrap() ?? null,
  settlementStatus: state.settlement.kind,
  depositAmount: depositAmountOf(state),
  version: state.version,
  state: projectionState(state),
});

export const createAppointmentEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly AppointmentProjectionEvent[]) =>
    ResultAsync.fromPromise<void, AppointmentStoreError>(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            const state = event.aggregateState;
            const values = toAppointmentValues(state);
            const expectedVersion = state.version === 1
              ? state.version
              : AppointmentVersion.schema.parse(state.version - 1);
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
                      eq(appointmentsTable.version, expectedVersion),
                    ))
                    .run().changes;
                case "ExaminationStarted":
                  return tx.update(appointmentsTable)
                    .set(values)
                    .where(and(
                      eq(appointmentsTable.appointmentId, state.appointmentId),
                      eq(appointmentsTable.status, "CheckedIn"),
                      eq(appointmentsTable.version, expectedVersion),
                    ))
                    .run().changes;
                case "PaymentRecorded":
                  return tx.update(appointmentsTable)
                    .set(values)
                    .where(and(
                      eq(appointmentsTable.appointmentId, state.appointmentId),
                      eq(appointmentsTable.status, "AwaitingPayment"),
                      eq(appointmentsTable.version, expectedVersion),
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
                      eq(appointmentsTable.version, expectedVersion),
                    ))
                    .run().changes;
                default:
                  return assertNever(event);
              }
            })();
            if (changes !== 1) {
              throw {
                kind: "StaleAppointmentVersion",
                appointmentId: event.aggregateId,
                expectedVersion,
              } as const;
            }
            persistDomainEvent(tx, event);
          });
        }),
      ),
      (cause): AppointmentStoreError => {
        const stale = StaleAppointmentVersionSchema.safeParse(cause);
        return stale.success
          ? stale.data
          : {
              kind: "RepositoryError",
              operation: "AppointmentEventStore.store",
              cause,
            };
      },
    ),
} as const);
