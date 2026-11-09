import type { Appointment } from "../domain/appointment/appointment.js";

export type AuditLog = Readonly<{
  eventId: string;
  appointmentId: string;
  eventName: string;
  payload: Appointment;
  occurredAt: string;
}>;

export type AuditEvent = Readonly<{
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
