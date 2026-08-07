import type { Result } from "neverthrow";

import type { Appointment } from "../domain/appointment.js";
import type { ClinicDomainEvent } from "../domain/clinic-domain-event.js";
import type { RepositoryError } from "./appointment-resolver.js";

export type AppointmentStore = Readonly<{
  save: (
    state: Appointment,
    events: ReadonlyArray<ClinicDomainEvent>,
  ) => Result<void, RepositoryError>;
}>;
