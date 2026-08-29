import type { Appointment, InExamination } from "../domain/appointment/index.js";
import type { AppointmentId } from "../domain/appointment/index.js";

export type AppointmentResolver = Readonly<{
  resolveById: (appointmentId: AppointmentId) => Appointment | undefined;
}>;

export type InExaminationStore = Readonly<{
  save: (appointment: InExamination) => void;
}>;

export type Dependencies = Readonly<{
  resolver: AppointmentResolver;
  store: InExaminationStore;
}>;
