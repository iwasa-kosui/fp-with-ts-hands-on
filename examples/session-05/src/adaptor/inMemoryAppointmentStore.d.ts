import type { Appointment, Scheduled } from "../domain/appointment/index.js";
import type { AppointmentResolver } from "../useCase/dependencies.js";

export type AppointmentStore = AppointmentResolver & Readonly<{
  find: (appointmentId: string) => Appointment | undefined;
  reset: () => Scheduled;
  save: (appointment: Appointment) => void;
}>;
