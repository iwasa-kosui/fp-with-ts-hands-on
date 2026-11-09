import type { Appointment } from "../../../domain/appointment/appointment.js";

export type AppointmentRow = Readonly<{
  appointment_id: string;
  status: Appointment["kind"];
}>;

export const toRow = (appointment: Appointment): AppointmentRow => ({
  appointment_id: appointment.appointmentId,
  status: appointment.kind,
});
