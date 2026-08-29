import type { ResultAsync } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { Appointment, InExamination } from "../domain/appointment/index.js";
import type { ExaminationStarted } from "../domain/appointment/index.js";
import type { AppointmentId } from "../domain/appointment/index.js";
import type { AppointmentConflict } from "./errors.js";

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
