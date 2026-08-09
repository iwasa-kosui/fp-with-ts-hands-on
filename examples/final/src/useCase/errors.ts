import { err, ok, type Result } from "neverthrow";

import type { Appointment, CheckedIn } from "../domain/appointment/appointment.js";
import type { AppointmentId } from "../domain/appointment/appointmentId.js";
import type { User } from "../domain/user/user.js";
import type { UserId } from "../domain/user/userId.js";

export type UnauthorizedError = Readonly<{
  kind: "Unauthorized";
  actorUserId: UserId;
}>;

export type AppointmentNotFound = Readonly<{
  kind: "AppointmentNotFound";
  appointmentId: AppointmentId;
}>;

export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentId;
  expectedKind: "CheckedIn";
  actualKind: Exclude<Appointment["kind"], "CheckedIn">;
}>;

export const ensureUserFound = (
  actorUserId: UserId,
) =>
  (user: User | undefined): Result<User, UnauthorizedError> =>
    user === undefined
      ? err({ kind: "Unauthorized", actorUserId })
      : ok(user);

export const ensureAppointmentFound = (
  appointmentId: AppointmentId,
) =>
  (appointment: Appointment | undefined): Result<Appointment, AppointmentNotFound> =>
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
        expectedKind: "CheckedIn",
        actualKind: appointment.kind,
      });
