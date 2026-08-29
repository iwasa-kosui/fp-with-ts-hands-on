import type { Appointment, Scheduled } from "../domain/appointment/index.js";

export type AppointmentStore = Readonly<{
  find: (appointmentId: string) => Appointment | undefined;
  reset: () => Scheduled;
  save: (appointment: Appointment) => void;
}>;

export const createInMemoryAppointmentStore = (
  initial: Scheduled,
): AppointmentStore => {
  let appointment: Appointment = initial;

  return {
    find: (appointmentId) =>
      appointment.appointmentId === appointmentId ? appointment : undefined,
    reset: () => {
      appointment = initial;
      return initial;
    },
    save: (next) => {
      appointment = next;
    },
  };
};
