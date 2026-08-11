import type { ResultAsync } from "neverthrow";

import type { Appointment } from "./appointment.js";
import type { AppointmentId } from "./appointmentId.js";
import type { RepositoryError } from "./repositoryError.js";

export type AppointmentResolver = Readonly<{
  resolveById: (
    appointmentId: AppointmentId,
  ) => ResultAsync<Appointment | undefined, RepositoryError>;
}>;
