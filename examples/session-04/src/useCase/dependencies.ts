import type {
  Appointment,
  InExamination,
  Scheduled,
} from "../domain/appointment/index.js";
import type { AppointmentId } from "../domain/appointment/index.js";

export type AppointmentResolver = Readonly<{
  resolveById: (appointmentId: AppointmentId) => Appointment | undefined;
}>;

export type InExaminationStore = Readonly<{
  save: (appointment: InExamination) => void;
}>;

export type AppointmentStore = AppointmentResolver & Readonly<{
  find: (appointmentId: string) => Appointment | undefined;
  reset: () => Scheduled;
  save: (appointment: Appointment) => void;
}>;

export type Dependencies = Readonly<{
  resolver: AppointmentResolver;
  store: InExaminationStore;
}>;
