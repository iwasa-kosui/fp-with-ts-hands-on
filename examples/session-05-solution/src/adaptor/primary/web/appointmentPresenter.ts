import type { Appointment } from "../../../domain/appointment/appointment.js";

export type AppointmentView = Readonly<{
  appointmentId: string;
  status: Appointment["kind"];
}>;

export const presentAppointment = (appointment: Appointment): AppointmentView => ({
  appointmentId: appointment.appointmentId,
  status: appointment.kind,
});
