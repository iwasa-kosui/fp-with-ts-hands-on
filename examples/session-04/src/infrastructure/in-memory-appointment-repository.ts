import type { Appointment } from "../domain/appointment.js";
import type { AppointmentId } from "../domain/appointment-id.js";
import type { AppointmentRepository } from "../ports/appointment-repository.js";

export const createInMemoryAppointmentRepository = (
  initialAppointments: ReadonlyArray<Appointment>,
): AppointmentRepository => {
  const appointments = new Map<AppointmentId, Appointment>();
  initialAppointments.forEach((appointment) => {
    appointments.set(appointment.appointmentId, appointment);
  });

  return {
    findById: (id) => appointments.get(id),
    save: (appointment) => {
      appointments.set(appointment.appointmentId, appointment);
    },
  };
};
