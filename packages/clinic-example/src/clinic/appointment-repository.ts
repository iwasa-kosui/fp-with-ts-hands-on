import type { Appointment } from "./appointment.js";
import type { AppointmentId } from "./appointment-id.js";

export type AppointmentRepository = Readonly<{
  findById: (id: AppointmentId) => Appointment | undefined;
  save: (appointment: Appointment) => void;
}>;

export const createInMemoryAppointmentRepository = (
  initial: ReadonlyArray<Appointment> = [],
): AppointmentRepository => {
  const store = new Map(initial.map((appointment) => [appointment.id, appointment]));
  return {
    findById: (id) => store.get(id),
    save: (appointment) => { store.set(appointment.id, appointment); },
  };
};
