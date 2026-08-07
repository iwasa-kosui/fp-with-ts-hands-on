import type { Result } from "neverthrow";

import type { Appointment } from "../domain/appointment.js";
import type { AppointmentId } from "../domain/appointment-id.js";

export type RepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: "FindById" | "Save";
}>;

export type AppointmentResolver = Readonly<{
  findById: (
    appointmentId: AppointmentId,
  ) => Result<Appointment | undefined, RepositoryError>;
}>;
