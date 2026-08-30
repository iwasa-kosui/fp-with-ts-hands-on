import { sql } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";

import {
  Appointment,
  type AppointmentId,
  type Scheduled,
} from "../../../domain/appointment/index.js";
import type { ExaminationStarted } from "../../../domain/appointment/index.js";
import type {
  AppointmentResolver,
  ExaminationStartedStore as ExaminationStartedStorePort,
} from "../../../useCase/dependencies.js";
import type { AppointmentConflict } from "../../../useCase/errors.js";
import { AppointmentPersistenceError } from "./appointmentPersistenceError.js";
import type { SqliteDatabase } from "./db.js";
import { parsePersistedAppointment } from "./persistedAppointment.js";
import { appointmentsTable, auditLogsTable } from "./schema.js";

export const INITIAL_AUDIT_EVENT_ID = "00000000-0000-4000-8000-000000000000";

type SqliteTransaction = Parameters<
  Parameters<SqliteDatabase["transaction"]>[0]
>[0];
type SqliteExecutor = SqliteDatabase | SqliteTransaction;

export type SqliteExaminationStartedStore = AppointmentResolver &
  ExaminationStartedStorePort &
  Readonly<{
    find: (appointmentId: string) => Appointment | undefined;
    reset: () => Scheduled;
    save: (appointment: Appointment) => void;
    seedIfEmpty: () => void;
  }>;

const toAppointmentRow = (appointment: Appointment) => ({
  appointmentId: appointment.appointmentId,
  ownerId: appointment.ownerId,
  petId: appointment.petId,
  status: appointment.kind,
  state: JSON.stringify(appointment),
});

const toAuditRow = (event: ExaminationStarted) => ({
  appointmentId: event.appointmentId,
  eventId: event.eventId,
  eventName: event.kind,
  occurredAt: event.occurredAt,
  payload: {
    appointmentId: event.appointmentId,
    examinationStartedAt: event.aggregateState.examinationStartedAt,
    veterinarianId: event.aggregateState.veterinarianId,
  },
});

export const createExaminationStartedStore = (
  database: SqliteDatabase,
  initialAppointment: Scheduled,
): SqliteExaminationStartedStore => {
  const find = (appointmentId: string): Appointment | undefined => {
    let row: Readonly<{ state: string }> | undefined;
    try {
      row = database
        .select({ state: appointmentsTable.state })
        .from(appointmentsTable)
        .where(sql`${appointmentsTable.appointmentId} = ${appointmentId}`)
        .get();
    } catch (cause) {
      throw new AppointmentPersistenceError("resolve", cause);
    }

    return row === undefined ? undefined : parsePersistedAppointment(row.state);
  };

  const findInTransaction = (
    transaction: SqliteTransaction,
    appointmentId: AppointmentId,
  ): Appointment | undefined => {
    let row: Readonly<{ state: string }> | undefined;
    try {
      row = transaction
        .select({ state: appointmentsTable.state })
        .from(appointmentsTable)
        .where(sql`${appointmentsTable.appointmentId} = ${appointmentId}`)
        .get();
    } catch (cause) {
      throw new AppointmentPersistenceError("resolve", cause);
    }

    return row === undefined ? undefined : parsePersistedAppointment(row.state);
  };

  const saveState = (
    executor: SqliteExecutor,
    appointment: Appointment,
  ): void => {
    const row = toAppointmentRow(appointment);
    try {
      executor
        .insert(appointmentsTable)
        .values(row)
        .onConflictDoUpdate({
          target: appointmentsTable.appointmentId,
          set: row,
        })
        .run();
    } catch (cause) {
      throw new AppointmentPersistenceError("save-state", cause);
    }
  };

  const appendAudit = (
    executor: SqliteExecutor,
    event: ExaminationStarted,
  ): void => {
    try {
      executor.insert(auditLogsTable).values(toAuditRow(event)).run();
    } catch (cause) {
      throw new AppointmentPersistenceError("append-audit", cause);
    }
  };

  const reset = (): Scheduled => {
    try {
      database.delete(auditLogsTable).run();
      database.delete(appointmentsTable).run();
    } catch (cause) {
      throw new AppointmentPersistenceError("save-state", cause);
    }

    saveState(database, initialAppointment);
    try {
      database
        .insert(auditLogsTable)
        .values({
          appointmentId: initialAppointment.appointmentId,
          eventId: INITIAL_AUDIT_EVENT_ID,
          eventName: "AppointmentSeeded",
          occurredAt: initialAppointment.scheduledAt,
          payload: { appointmentId: initialAppointment.appointmentId },
        })
        .run();
    } catch (cause) {
      throw new AppointmentPersistenceError("append-audit", cause);
    }
    return initialAppointment;
  };

  const storeAtomically = (event: ExaminationStarted) =>
    database.transaction((transaction) => {
      const current = findInTransaction(transaction, event.appointmentId);
      if (current === undefined || current.kind !== "CheckedIn") {
        return err({
          kind: "AppointmentConflict",
          appointmentId: event.appointmentId,
        } as const);
      }

      const committedEvent = Appointment.startExamination({
        eventId: event.eventId,
        occurredAt: event.occurredAt,
      })(current, event.aggregateState.veterinarianId);

      saveState(transaction, committedEvent.aggregateState);
      appendAudit(transaction, committedEvent);
      return ok(undefined);
    });

  return {
    find,
    resolveById: find,
    reset,
    save: (appointment) => saveState(database, appointment),
    seedIfEmpty: () => {
      let row: Readonly<{ appointmentId: string }> | undefined;
      try {
        row = database
          .select({ appointmentId: appointmentsTable.appointmentId })
          .from(appointmentsTable)
          .get();
      } catch (cause) {
        throw new AppointmentPersistenceError("resolve", cause);
      }
      if (row === undefined) reset();
    },
    store: (event) =>
      ResultAsync.fromSafePromise(
        Promise.resolve().then(() => storeAtomically(event)),
      ).andThen((result) => result),
  };
};
