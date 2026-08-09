import { and, eq, inArray, ne, or } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { z } from "zod";

import { Timestamp, type Timestamp as TimestampValue } from "../../../../domain/aggregate/timestamp.js";
import type { Appointment } from "../../../../domain/appointment/appointment.js";
import { AppointmentDuration, type AppointmentDuration as AppointmentDurationValue } from "../../../../domain/appointment/appointmentDuration.js";
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
const VeterinarianScheduleConflictSchema = z.object({
  kind: z.literal("VeterinarianScheduleConflict"),
  appointmentId: AppointmentId.schema,
  conflictingAppointmentId: AppointmentId.schema,
});
const StoredVeterinarianScheduleSchema = z.object({
  appointmentId: AppointmentId.schema,
  scheduledAt: Timestamp.schema,
  durationMinutes: AppointmentDuration.schema,
});

const intervalEndEpochMilliseconds = (
  scheduledAt: TimestampValue,
  durationMinutes: AppointmentDurationValue,
): number => {
  const end = Timestamp.toEpochMilliseconds(scheduledAt) + durationMinutes * 60_000;
  if (!Timestamp.schema.safeParse(new Date(end).toISOString()).success) {
    throw new TypeError("Appointment interval end is outside Timestamp range");
  }
  return end;
};

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
  const storedSchedules = tx
    .select({
      appointmentId: appointmentsTable.appointmentId,
      scheduledAt: appointmentsTable.scheduledAt,
      durationMinutes: appointmentsTable.durationMinutes,
    })
    .from(appointmentsTable)
    .where(and(
      eq(appointmentsTable.assignedVeterinarianId, state.assignedVeterinarianId),
      inArray(appointmentsTable.status, ["Scheduled", "CheckedIn"]),
      ne(appointmentsTable.appointmentId, state.appointmentId),
    ))
    .all()
    .map((row) => StoredVeterinarianScheduleSchema.parse(row));
  const storedIntervals = storedSchedules.map((schedule) => ({
    appointmentId: schedule.appointmentId,
    start: Timestamp.toEpochMilliseconds(schedule.scheduledAt),
    end: intervalEndEpochMilliseconds(
      schedule.scheduledAt,
      schedule.durationMinutes,
    ),
  }));
  const candidateStart = Timestamp.toEpochMilliseconds(state.scheduledAt);
  const candidateEnd = intervalEndEpochMilliseconds(
    state.scheduledAt,
    state.durationMinutes,
  );
  const conflicting = storedIntervals.find(({ start, end }) =>
    start < candidateEnd && candidateStart < end,
  );
  if (conflicting !== undefined) {
    throw {
      kind: "VeterinarianScheduleConflict",
      appointmentId: state.appointmentId,
      conflictingAppointmentId: conflicting.appointmentId,
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
