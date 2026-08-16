import type { ResultAsync } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { Appointment, CheckedIn, InExamination } from "../domain/appointment/appointment.js";
import type { ExaminationStarted } from "../domain/appointment/examinationStarted.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { VeterinarianId } from "../domain/ids/veterinarianId.js";
import type { AppointmentConflict } from "./errors.js";

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

export type EventContextDependencies = Readonly<{
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
}>;

export type ExaminationStartedStore = Readonly<{
  store: (event: ExaminationStarted) => ResultAsync<void, AppointmentConflict>;
}>;

export type EffectsDependencies = Readonly<{
  resolver: AppointmentResolver;
  store: ExaminationStartedStore;
}> & EventContextDependencies;
