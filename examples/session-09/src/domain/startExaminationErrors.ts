import { ok, type Result } from "neverthrow";

import type { AppointmentId } from "./appointmentId.js";

export type AppointmentNotFound = Readonly<{
  kind: "AppointmentNotFound";
  appointmentId: AppointmentId;
}>;

export const ensureFound = (
  _appointment: unknown,
  _appointmentId: AppointmentId,
): Result<undefined, AppointmentNotFound> => ok(undefined);
