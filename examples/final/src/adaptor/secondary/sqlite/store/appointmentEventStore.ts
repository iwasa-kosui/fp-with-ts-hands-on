import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
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
import { sqliteJulianDay } from "../sqliteTimestamp.js";

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
const VeterinarianScheduleConflictSchema = z.object({
  kind: z.literal("VeterinarianScheduleConflict"),
  appointmentId: AppointmentId.schema,
  conflictingAppointmentId: AppointmentId.schema,
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

const checksVeterinarianSchedule = (
  event: AppointmentProjectionEvent,
): boolean =>
  event.kind === "AppointmentBooked" ||
  event.kind === "AppointmentUpdated" ||
  event.kind === "AppointmentWalkInRegistered" ||
  event.kind === "AppointmentVeterinarianReassigned" ||
  event.kind === "ExaminationStarted";

const ensureVeterinarianScheduleAvailable = (
  tx: Parameters<Parameters<SqliteDatabase["transaction"]>[0]>[0],
  event: AppointmentProjectionEvent,
): void => {
  const state = event.aggregateState;
  if (!checksVeterinarianSchedule(event) || state.assignedVeterinarianId === null) return;
  const storedStart = sqliteJulianDay(appointmentsTable.scheduledAt);
  const storedEnd = sqliteJulianDay(
    appointmentsTable.scheduledAt,
    sql`'+' || ${appointmentsTable.durationMinutes} || ' minutes'`,
  );
  const candidateStart = sqliteJulianDay(state.scheduledAt);
  const candidateEnd = sqliteJulianDay(
    state.scheduledAt,
    sql`'+' || ${state.durationMinutes} || ' minutes'`,
  );
  const conflicting = tx
    .select({ appointmentId: appointmentsTable.appointmentId })
    .from(appointmentsTable)
    .where(and(
      eq(appointmentsTable.assignedVeterinarianId, state.assignedVeterinarianId),
      inArray(appointmentsTable.status, ["Scheduled", "CheckedIn"]),
      ne(appointmentsTable.appointmentId, state.appointmentId),
      sql`${storedStart} < ${candidateEnd}`,
      sql`${candidateStart} < ${storedEnd}`,
    ))
    .limit(1)
    .get();
  if (conflicting !== undefined) {
    throw {
      kind: "VeterinarianScheduleConflict",
      appointmentId: state.appointmentId,
      conflictingAppointmentId: AppointmentId.schema.parse(conflicting.appointmentId),
    } as const;
  }
};

export const createAppointmentEventStore = (db: SqliteDatabase) => ({
  store: (...events: readonly AppointmentProjectionEvent[]) =>
    ResultAsync.fromPromise<void, AppointmentStoreError>(
      Promise.resolve().then(() =>
        db.transaction((tx) => {
          events.forEach((event) => {
            const state = event.aggregateState;
            ensureVeterinarianScheduleAvailable(tx, event);
            const values = toAppointmentValues(state);
            const expectedVersion = state.version === 1
              ? state.version
              : AppointmentVersion.schema.parse(state.version - 1);
            const changes = (() => {
              switch (event.kind) {
                case "AppointmentBooked":
                case "AppointmentWalkInRegistered":
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
                case "AppointmentUpdated":
                  return tx.update(appointmentsTable)
                    .set(values)
                    .where(and(
                      eq(appointmentsTable.appointmentId, state.appointmentId),
                      eq(appointmentsTable.status, "Scheduled"),
                      eq(appointmentsTable.version, expectedVersion),
                    ))
                    .run().changes;
                case "AppointmentVeterinarianReassigned":
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
                case "AppointmentReceptionNoteUpdated":
                  return tx.update(appointmentsTable)
                    .set(values)
                    .where(and(
                      eq(appointmentsTable.appointmentId, state.appointmentId),
                      inArray(appointmentsTable.status, [
                        "Scheduled",
                        "CheckedIn",
                        "InExamination",
                        "AwaitingPayment",
                      ]),
                      eq(appointmentsTable.version, expectedVersion),
                    ))
                    .run().changes;
                case "AppointmentDepositReceived":
                  return tx.update(appointmentsTable)
                    .set(values)
                    .where(and(
                      eq(appointmentsTable.appointmentId, state.appointmentId),
                      or(
                        eq(appointmentsTable.status, "Scheduled"),
                        eq(appointmentsTable.status, "CheckedIn"),
                      ),
                      eq(appointmentsTable.settlementStatus, "NoPayment"),
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
                case "AppointmentFinalSettlementRecorded":
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
        }, { behavior: "immediate" }),
      ),
      (cause): AppointmentStoreError => {
        const stale = StaleAppointmentVersionSchema.safeParse(cause);
        if (stale.success) return stale.data;
        const conflict = VeterinarianScheduleConflictSchema.safeParse(cause);
        return conflict.success
          ? conflict.data
          : {
              kind: "RepositoryError",
              operation: "AppointmentEventStore.store",
              cause,
            };
      },
    ),
} as const);
