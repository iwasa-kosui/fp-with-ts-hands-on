import { err, ok, type Result } from "neverthrow";

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

export type RepositoryFailure = Readonly<{
  kind: "RepositoryFailure";
  operation: "ExaminationStartedStore.store";
  cause: unknown;
}>;

export type RepositoryError = Readonly<{
  kind: "RepositoryError";
  operation: "ExaminationStartedStore.store";
}>;

export type StartExaminationError = AppointmentNotFound | InvalidAppointmentState;
export type StartExaminationWithEffectsError = StartExaminationError | RepositoryError;

export const toRepositoryError = (
  failure: RepositoryFailure,
): RepositoryError => ({
  kind: "RepositoryError",
  operation: failure.operation,
});

export const ensureAppointmentFound = (
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
    : err({ kind: "InvalidAppointmentState", actual: appointment.kind });
