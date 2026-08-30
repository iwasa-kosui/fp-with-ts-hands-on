import type { Appointment, InExamination } from "../domain/appointment/index.js";
import type { ExaminationStarted } from "../domain/appointment/index.js";
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

export type EffectsDependencies = Readonly<{
  resolver: AppointmentResolver;
  stateStore: Readonly<{
    save: (appointment: InExamination) => Promise<void>;
  }>;
  eventLog: Readonly<{
    append: (event: ExaminationStarted) => Promise<void>;
  }>;
}>;
