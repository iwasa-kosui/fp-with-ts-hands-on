import { sql } from "drizzle-orm";
import { err, ok, ResultAsync } from "neverthrow";

import type {
  Appointment,
  AppointmentId,
  InExamination,
  Scheduled,
} from "../../../domain/appointment/index.js";
import type { ExaminationStarted } from "../../../domain/appointment/index.js";
import type { AppointmentResolver } from "../../../useCase/dependencies.js";
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

export type AppointmentStore = AppointmentResolver & Readonly<{
  atomicStore: Readonly<{
    store: (event: ExaminationStarted) => ResultAsync<void, AppointmentConflict>;
  }>;
  eventLog: Readonly<{
    append: (event: ExaminationStarted) => Promise<void>;
  }>;
  find: (appointmentId: string) => Appointment | undefined;
  reset: () => Scheduled;
  save: (appointment: Appointment) => void;
  seedIfEmpty: () => void;
  stateStore: Readonly<{
    save: (appointment: InExamination) => Promise<void>;
  }>;
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
  payload: event,
});

export const createAppointmentStore = (
  database: SqliteDatabase,
  initialAppointment: Scheduled,
): AppointmentStore => {
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
    return database.transaction((transaction) => {
      try {
        transaction.delete(auditLogsTable).run();
        transaction.delete(appointmentsTable).run();
      } catch (cause) {
        throw new AppointmentPersistenceError("save-state", cause);
      }

      saveState(transaction, initialAppointment);
      try {
        transaction.insert(auditLogsTable).values({
          appointmentId: initialAppointment.appointmentId,
          eventId: INITIAL_AUDIT_EVENT_ID,
          eventName: "AppointmentSeeded",
          occurredAt: initialAppointment.scheduledAt,
          payload: { appointmentId: initialAppointment.appointmentId },
        }).run();
      } catch (cause) {
        throw new AppointmentPersistenceError("append-audit", cause);
      }
      return initialAppointment;
    });
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

      saveState(transaction, event.aggregateState);
      appendAudit(transaction, event);
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
    stateStore: {
      save: async (appointment) => saveState(database, appointment),
    },
    eventLog: {
      append: async (event) => appendAudit(database, event),
    },
    atomicStore: {
      store: (event) => ResultAsync.fromSafePromise(
        Promise.resolve().then(() => storeAtomically(event)),
      ).andThen((result) => result),
    },
  };
};
