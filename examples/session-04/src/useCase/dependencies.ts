import type { Appointment, InExamination } from "../domain/appointment/appointment.js";
import type { ExaminationStarted } from "../domain/appointment/examinationStarted.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { ResultDependencies } from "./resultDependencies.js";

export type Dependencies = Readonly<{
  resolver: Readonly<{
    resolveById: (appointmentId: AppointmentId) => Appointment | undefined;
  }>;
  transition: ResultDependencies["transition"];
  stateStore: Readonly<{
    save: (appointment: InExamination) => Promise<void>;
  }>;
  eventLog: Readonly<{
    append: (event: ExaminationStarted) => Promise<void>;
  }>;
}>;
