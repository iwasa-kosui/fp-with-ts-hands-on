import type { Result } from "neverthrow";

import type { AppointmentId } from "../domain/appointment-id.js";
import type { Appointment } from "../domain/appointment.js";

export type RepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: "FindById" | "Save";
}>;

export type AppointmentResolver = Readonly<{
  findById: (appointmentId: AppointmentId) => Result<Appointment | undefined, RepositoryError>;
}>;
