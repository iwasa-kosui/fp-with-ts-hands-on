import { err, ok, type Result } from "neverthrow";

import type { Appointment, CheckedIn } from "./appointment.js";
import type { AppointmentId } from "./appointmentId.js";
import type { SchemaValidationError } from "./shared/schemaResult.js";

export type AppointmentNotFound = Readonly<{
  kind: "AppointmentNotFound";
  appointmentId: AppointmentId;
}>;

export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  actualKind: Appointment["kind"];
  expectedKind: "CheckedIn";
}>;

export type StartExaminationError =
  | SchemaValidationError
  | AppointmentNotFound
  | InvalidAppointmentState;

export const ensureFound = (
  appointment: Appointment | undefined,
  appointmentId: AppointmentId,
): Result<Appointment, AppointmentNotFound> =>
  appointment === undefined
    ? err({ kind: "AppointmentNotFound", appointmentId })
    : ok(appointment);

export const ensureCheckedIn = (
  appointment: Appointment,
): Result<CheckedIn, InvalidAppointmentState> =>
  appointment.kind === "CheckedIn"
    ? ok(appointment)
    : err({
        kind: "InvalidAppointmentState",
        appointmentId: appointment.appointmentId,
        actualKind: appointment.kind,
        expectedKind: "CheckedIn",
      });
