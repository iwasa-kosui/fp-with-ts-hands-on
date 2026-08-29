import type { Appointment, InExamination } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";

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
