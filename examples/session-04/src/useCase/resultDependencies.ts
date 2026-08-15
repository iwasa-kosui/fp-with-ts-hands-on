import type { Appointment, CheckedIn, InExamination } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { VeterinarianId } from "../domain/ids/veterinarianId.js";

export type ResultDependencies = Readonly<{
  resolver: Readonly<{
    resolveById: (appointmentId: AppointmentId) => Appointment | undefined;
  }>;
  store: Readonly<{
    save: (appointment: InExamination) => void;
  }>;
  transition: (
    appointment: CheckedIn,
    veterinarianId: VeterinarianId,
    examinationStartedAt: string,
  ) => InExamination;
}>;
