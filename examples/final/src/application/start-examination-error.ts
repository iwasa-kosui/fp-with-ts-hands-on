import type { AppointmentId } from "../domain/appointment-id.js";
import type { Appointment } from "../domain/appointment.js";
import type { ValidationError } from "../shared/schema-result.js";
import type { RepositoryError } from "../ports/appointment-resolver.js";

export type AppointmentNotFound = Readonly<{
  kind: "AppointmentNotFound";
  appointmentId: AppointmentId;
}>;

export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  expectedKind: "CheckedIn";
  actualKind: Appointment["kind"];
}>;

export type StartExaminationError =
  | ValidationError
  | AppointmentNotFound
  | InvalidAppointmentState
  | RepositoryError;
