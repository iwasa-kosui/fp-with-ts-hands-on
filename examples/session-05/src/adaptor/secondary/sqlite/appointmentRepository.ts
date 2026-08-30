import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import type {
  Appointment,
  AppointmentId,
  InExamination,
  Scheduled,
  VeterinarianId,
} from "../../../domain/appointment/index.js";
import type {
  AppointmentResolver,
  InExaminationStore,
} from "../../../useCase/dependencies.js";
import { AppointmentPersistenceError } from "./appointmentPersistenceError.js";
import type { SqliteDatabase } from "./db.js";
import { parsePersistedAppointment } from "./persistedAppointment.js";
import { appointmentsTable, auditLogsTable } from "./schema.js";

export const INITIAL_AUDIT_EVENT_ID = "00000000-0000-4000-8000-000000000000";

export type ExaminationStartedAuditPayload = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export type AuditLog = Readonly<{
  eventId: string;
  appointmentId: string;
  eventName: string;
  payload: unknown;
  occurredAt: string;
}>;

export type AppointmentRepository = AppointmentResolver &
  InExaminationStore &
  Readonly<{
    find: (appointmentId: string) => Appointment | undefined;
    reset: (initialAppointment: Scheduled) => void;
    save: (appointment: Appointment) => void;
    seedIfEmpty: (initialAppointment: Scheduled) => void;
    listAuditLogs: () => AuditLog[];
  }>;

const toAppointmentRow = (appointment: Appointment) => ({
  appointmentId: appointment.appointmentId,
  ownerId: appointment.ownerId,
  petId: appointment.petId,
  status: appointment.kind,
  state: JSON.stringify(appointment),
});

const toExaminationStartedAuditPayload = (
  appointment: InExamination,
): ExaminationStartedAuditPayload => ({
  appointmentId: appointment.appointmentId,
  veterinarianId: appointment.veterinarianId,
  examinationStartedAt: appointment.examinationStartedAt,
});

export const createAppointmentRepository = (
  database: SqliteDatabase,
): AppointmentRepository => {
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

  const saveState = (appointment: Appointment): void => {
    const row = toAppointmentRow(appointment);
    try {
      database
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
    eventId: string,
    eventName: string,
    occurredAt: string,
    payload: unknown,
    appointmentId: string,
  ): void => {
    try {
      database
        .insert(auditLogsTable)
        .values({ eventId, eventName, occurredAt, payload, appointmentId })
        .run();
    } catch (cause) {
      throw new AppointmentPersistenceError("append-audit", cause);
    }
  };

  const appendExaminationStartedAudit = (appointment: InExamination): void => {
    const payload = toExaminationStartedAuditPayload(appointment);
    appendAudit(
      randomUUID(),
      "ExaminationStarted",
      payload.examinationStartedAt,
      payload,
      payload.appointmentId,
    );
  };

  const save = (appointment: Appointment): void => {
    saveState(appointment);
    if (appointment.kind === "InExamination") {
      appendExaminationStartedAudit(appointment);
    }
  };

  const reset = (initialAppointment: Scheduled): void => {
    database.transaction((transaction) => {
      try {
        transaction.delete(auditLogsTable).run();
        transaction.delete(appointmentsTable).run();
        transaction
          .insert(appointmentsTable)
          .values(toAppointmentRow(initialAppointment))
          .run();
      } catch (cause) {
        throw new AppointmentPersistenceError("save-state", cause);
      }

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
    });
  };

  return {
    find,
    resolveById: find,
    save,
    reset,
    seedIfEmpty: (initialAppointment) => {
      let row: Readonly<{ appointmentId: string }> | undefined;
      try {
        row = database
          .select({ appointmentId: appointmentsTable.appointmentId })
          .from(appointmentsTable)
          .get();
      } catch (cause) {
        throw new AppointmentPersistenceError("resolve", cause);
      }
      if (row === undefined) reset(initialAppointment);
    },
    listAuditLogs: () => {
      try {
        return database
          .select()
          .from(auditLogsTable)
          .orderBy(sql`rowid`)
          .all();
      } catch (cause) {
        throw new AppointmentPersistenceError("resolve", cause);
      }
    },
  };
};
