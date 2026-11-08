import type { Appointment, CheckedIn } from "../domain/appointment/index.js";
import type { AppointmentId } from "../domain/appointment/index.js";

export const ensureAppointmentFound = (
  appointment: Appointment | undefined,
  appointmentId: AppointmentId,
): Appointment => {
  if (appointment === undefined) {
    throw new Error(`Appointment ${appointmentId} was not found`);
  }

  return appointment;
};

export const ensureCheckedIn = (
  appointment: Appointment,
): CheckedIn => {
  if (appointment.kind !== "CheckedIn") {
    throw new Error(`Appointment state was ${appointment.kind}`);
  }

  return appointment;
};
