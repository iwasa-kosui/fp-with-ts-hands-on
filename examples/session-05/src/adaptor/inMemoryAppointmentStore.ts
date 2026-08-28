import type { Appointment, Scheduled } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { AppointmentResolver } from "../useCase/dependencies.js";

export type AppointmentStore = AppointmentResolver & Readonly<{
  find: (appointmentId: string) => Appointment | undefined;
  reset: () => Scheduled;
  save: (appointment: Appointment) => void;
}>;

export const createInMemoryAppointmentStore = (
  initial: Scheduled,
): AppointmentStore => {
  let appointment: Appointment = initial;
  const find = (appointmentId: string | AppointmentId) =>
    appointment.appointmentId === appointmentId ? appointment : undefined;

  return {
    find,
    resolveById: find,
    reset: () => {
      appointment = initial;
      return initial;
    },
    save: (next) => {
      appointment = next;
    },
  };
};
