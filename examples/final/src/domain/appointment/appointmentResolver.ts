import type { ResultAsync } from "neverthrow";

import type { RepositoryError } from "../aggregate/repositoryError.js";
import type { Appointment } from "./appointment.js";
import type { AppointmentId } from "./appointmentId.js";

export type AppointmentResolver = Readonly<{
  resolveById: (appointmentId: AppointmentId) => ResultAsync<Appointment | undefined, RepositoryError>;
}>;
