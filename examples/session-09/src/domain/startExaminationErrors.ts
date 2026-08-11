import { err, ok, type Result } from "neverthrow";

import type { Appointment, CheckedIn } from "./appointment.js";
import type { AppointmentId } from "./appointmentId.js";

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

export const ensureFound = (
  _appointment: unknown,
  _appointmentId: AppointmentId,
): Result<undefined, AppointmentNotFound> => ok(undefined);

export const ensureCheckedIn = (
  appointment: Appointment,
): Result<CheckedIn, InvalidAppointmentState> =>
  err({
    kind: "InvalidAppointmentState",
    appointmentId: appointment.appointmentId,
    actualKind: "CheckedIn",
    expectedKind: "CheckedIn",
  });
