import { sql } from "drizzle-orm";

import type { Appointment } from "../../../domain/appointment/appointment.js";
import type { SqliteDatabase } from "./db.js";
import { appointmentsTable, auditLogsTable } from "./schema.js";

export const INITIAL_AUDIT_EVENT_ID = "00000000-0000-4000-8000-000000000000";

export type OwnerContactContext = Readonly<{
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
}>;

export type PersistenceContext = Readonly<{
  ownerContact: OwnerContactContext;
}>;

export type AuditEvent = Readonly<{
  eventId: string;
  eventName: string;
  occurredAt: string;
  appointment: Appointment;
  payload: Readonly<Record<string, unknown>>;
}>;

export type AuditLog = Readonly<{
  eventId: string;
  appointmentId: string;
  eventName: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: string;
}>;

export type AppointmentRepository = Readonly<{
  find: (appointmentId: string) => Appointment | undefined;
  save: (appointment: Appointment) => void;
  appendAudit: (event: AuditEvent) => void;
  listAuditLogs: () => AuditLog[];
  reset: (initialAppointment: Appointment, context: PersistenceContext) => void;
  seedIfEmpty: (initialAppointment: Appointment, context: PersistenceContext) => void;
}>;

const toAppointmentRow = (
  appointment: Appointment,
  ownerContact: OwnerContactContext,
) => ({
  appointmentId: appointment.appointmentId,
  ownerId: appointment.ownerId,
  petId: appointment.petId,
  status: appointment.kind,
  state: appointment,
  ownerContact,
});

export const createAppointmentRepository = (
  database: SqliteDatabase,
): AppointmentRepository => {
  const ownerContactFor = (appointmentId: string): OwnerContactContext => {
    const row = database
      .select({ ownerContact: appointmentsTable.ownerContact })
      .from(appointmentsTable)
      .where(sql`${appointmentsTable.appointmentId} = ${appointmentId}`)
      .get();

    if (row === undefined) throw new Error("Appointment not found");
    return row.ownerContact as OwnerContactContext;
  };

  const save = (appointment: Appointment): void => {
    const row = toAppointmentRow(
      appointment,
      ownerContactFor(appointment.appointmentId),
    );

    database
      .insert(appointmentsTable)
      .values(row)
      .onConflictDoUpdate({
        target: appointmentsTable.appointmentId,
        set: row,
      })
      .run();
  };

  const appendAudit = ({ appointment, payload, ...event }: AuditEvent): void => {
    database
      .insert(auditLogsTable)
      .values({
        ...event,
        appointmentId: appointment.appointmentId,
        payload: {
          ...payload,
          appointment,
          ownerContact: ownerContactFor(appointment.appointmentId),
        },
      })
      .run();
  };

  const reset = (
    initialAppointment: Appointment,
    context: PersistenceContext,
  ): void => {
    database.transaction((transaction) => {
      transaction.delete(auditLogsTable).run();
      transaction.delete(appointmentsTable).run();
      transaction
        .insert(appointmentsTable)
        .values(toAppointmentRow(initialAppointment, context.ownerContact))
        .run();
      transaction.insert(auditLogsTable).values({
        eventId: INITIAL_AUDIT_EVENT_ID,
        appointmentId: initialAppointment.appointmentId,
        eventName: "AppointmentSeeded",
        occurredAt: initialAppointment.scheduledAt,
        payload: {
          appointment: initialAppointment,
          ownerContact: context.ownerContact,
        },
      }).run();
    });
  };

  return {
    find: (appointmentId) => {
      const row = database
        .select({ state: appointmentsTable.state })
        .from(appointmentsTable)
        .where(sql`${appointmentsTable.appointmentId} = ${appointmentId}`)
        .get();
      return row === undefined ? undefined : (row.state as Appointment);
    },
    save,
    appendAudit,
    listAuditLogs: () =>
      database
        .select()
        .from(auditLogsTable)
        .orderBy(sql`rowid`)
        .all()
        .map((audit) => ({
          ...audit,
          payload: audit.payload as Readonly<Record<string, unknown>>,
        })),
    reset,
    seedIfEmpty: (initialAppointment, context) => {
      const row = database
        .select({ appointmentId: appointmentsTable.appointmentId })
        .from(appointmentsTable)
        .get();
      if (row === undefined) reset(initialAppointment, context);
    },
  };
};
