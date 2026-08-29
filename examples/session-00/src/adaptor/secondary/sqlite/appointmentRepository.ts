import { sql } from "drizzle-orm";

import type { Appointment } from "../../../domain/appointment/appointment.js";
import type { SqliteDatabase } from "./db.js";
import { appointmentsTable, auditLogsTable } from "./schema.js";

export const INITIAL_AUDIT_EVENT_ID = "00000000-0000-4000-8000-000000000000";

export type AuditLog = Readonly<{
  eventId: string;
  appointmentId: string;
  eventName: string;
  payload: Appointment;
  occurredAt: string;
}>;

type AuditEvent = Readonly<{
  eventId: string;
  eventName: string;
  occurredAt: string;
  appointment: Appointment;
}>;

export type AppointmentRepository = Readonly<{
  find: (appointmentId: string) => Appointment | undefined;
  save: (appointment: Appointment) => void;
  appendAudit: (event: AuditEvent) => void;
  listAuditLogs: () => AuditLog[];
  reset: (initialAppointment: Appointment) => void;
  seedIfEmpty: (initialAppointment: Appointment) => void;
}>;

const toAppointmentRow = (appointment: Appointment) => ({
  appointmentId: appointment.appointmentId,
  ownerId: appointment.ownerId,
  petId: appointment.petId,
  status: appointment.status,
  state: appointment,
});

const toInitialAuditLog = (appointment: Appointment): AuditLog => ({
  eventId: INITIAL_AUDIT_EVENT_ID,
  appointmentId: appointment.appointmentId,
  eventName: "appointment.seeded",
  payload: appointment,
  occurredAt: appointment.scheduledAt,
});

export const createAppointmentRepository = (
  db: SqliteDatabase,
): AppointmentRepository => {
  const save = (appointment: Appointment): void => {
    const row = toAppointmentRow(appointment);

    db.insert(appointmentsTable)
      .values(row)
      .onConflictDoUpdate({
        target: appointmentsTable.appointmentId,
        set: row,
      })
      .run();
  };

  const appendAudit = ({ appointment, ...event }: AuditEvent): void => {
    db.insert(auditLogsTable)
      .values({
        ...event,
        appointmentId: appointment.appointmentId,
        payload: appointment,
      })
      .run();
  };

  const reset = (initialAppointment: Appointment): void => {
    db.transaction((transaction) => {
      transaction.delete(auditLogsTable).run();
      transaction.delete(appointmentsTable).run();
      transaction
        .insert(appointmentsTable)
        .values(toAppointmentRow(initialAppointment))
        .run();
      transaction
        .insert(auditLogsTable)
        .values(toInitialAuditLog(initialAppointment))
        .run();
    });
  };

  return {
    find: (appointmentId) => {
      const row = db
        .select({ state: appointmentsTable.state })
        .from(appointmentsTable)
        .where(sql`${appointmentsTable.appointmentId} = ${appointmentId}`)
        .get();

      return row === undefined ? undefined : (row.state as Appointment);
    },
    save,
    appendAudit,
    listAuditLogs: () =>
      db
        .select()
        .from(auditLogsTable)
        .orderBy(sql`rowid`)
        .all()
        .map((log) => ({ ...log, payload: log.payload as Appointment })),
    reset,
    seedIfEmpty: (initialAppointment) => {
      const appointment = db
        .select({ appointmentId: appointmentsTable.appointmentId })
        .from(appointmentsTable)
        .get();

      if (appointment === undefined) {
        reset(initialAppointment);
      }
    },
  };
};
