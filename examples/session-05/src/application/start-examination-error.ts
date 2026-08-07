import type { Appointment } from "../domain/appointment.js";
import type { AppointmentId } from "../domain/appointment-id.js";
import type { RepositoryError } from "../ports/appointment-resolver.js";
import type { ValidationError } from "../shared/schema-result.js";

export type StartExaminationError =
  | Readonly<{ kind: "AppointmentNotFound"; appointmentId: AppointmentId }>
  | Readonly<{
      kind: "InvalidAppointmentState";
      appointmentId: AppointmentId;
      actualKind: Appointment["kind"];
      expectedKind: "CheckedIn";
    }>
  | RepositoryError
  | ValidationError;
