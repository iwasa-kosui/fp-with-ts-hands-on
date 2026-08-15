import type { ResultAsync } from "neverthrow";

import type { Clock } from "../domain/aggregate/clock.js";
import type { EventIdGenerator } from "../domain/aggregate/eventIdGenerator.js";
import type { Appointment } from "../domain/appointment/appointment.js";
import type { ExaminationStarted } from "../domain/appointment/examinationStarted.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { RepositoryError } from "./errors.js";

export type AppointmentResolver = Readonly<{
  resolveById: (appointmentId: AppointmentId) => Appointment | undefined;
}>;

export type ExaminationStartedStore = Readonly<{
  store: (event: ExaminationStarted) => ResultAsync<void, RepositoryError>;
}>;

export type Dependencies = Readonly<{
  resolver: AppointmentResolver;
  clock: Clock;
  eventIdGenerator: EventIdGenerator;
  store: ExaminationStartedStore;
}>;
