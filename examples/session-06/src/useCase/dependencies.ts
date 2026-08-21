import type { Appointment, CheckedIn, InExamination } from "../domain/appointment/appointment.js";
import type { ExaminationStarted } from "../domain/appointment/examinationStarted.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { VeterinarianId } from "../domain/ids/veterinarianId.js";

export type AppointmentResolver = Readonly<{
  resolveById: (appointmentId: AppointmentId) => Appointment | undefined;
}>;

export type InExaminationStore = Readonly<{
  save: (appointment: InExamination) => void;
}>;

export type StartExaminationTransition = (
  appointment: CheckedIn,
  veterinarianId: VeterinarianId,
  examinationStartedAt: string,
) => InExamination;

export type Dependencies = Readonly<{
  resolver: AppointmentResolver;
  store: InExaminationStore;
  transition: StartExaminationTransition;
}>;

export type EffectsDependencies = Readonly<{
  resolver: AppointmentResolver;
  transition: StartExaminationTransition;
  stateStore: Readonly<{
    save: (appointment: InExamination) => Promise<void>;
  }>;
  eventLog: Readonly<{
    append: (event: ExaminationStarted) => Promise<void>;
  }>;
}>;
