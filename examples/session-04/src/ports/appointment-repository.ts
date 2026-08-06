import type { Appointment } from "../domain/appointment.js";
import type { AppointmentId } from "../domain/appointment-id.js";

export type AppointmentRepository = Readonly<{
  findById: (id: AppointmentId) => Appointment | undefined;
  save: (appointment: Appointment) => void;
}>;
