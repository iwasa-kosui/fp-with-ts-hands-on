import { ok, type Result } from "neverthrow";

import type { Appointment, CheckedIn } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";

export type AppointmentNotFound = Readonly<{
  kind: "AppointmentNotFound";
  appointmentId: AppointmentId;
}>;

export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  actual: Appointment["kind"];
}>;

export type StartExaminationError = AppointmentNotFound | InvalidAppointmentState;

export const ensureAppointmentFound = (
  appointment: Appointment | undefined,
  appointmentId: AppointmentId,
): Result<Appointment, AppointmentNotFound> => {
  if (appointment === undefined) {
    throw new Error(`Appointment ${appointmentId} was not found`);
  }

  return ok(appointment);
};

export const ensureCheckedIn = (
  appointment: Appointment,
): Result<CheckedIn, InvalidAppointmentState> => {
  if (appointment.kind !== "CheckedIn") {
    throw new Error(`Appointment state was ${appointment.kind}`);
  }

  return ok(appointment);
};
