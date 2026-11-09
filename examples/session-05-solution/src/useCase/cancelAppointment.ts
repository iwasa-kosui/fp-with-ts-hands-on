import { err, ok, type Result, type ResultAsync } from "neverthrow";

import {
  cancel,
  type Appointment,
  type Canceled,
  type CheckedIn,
  type Scheduled,
} from "../domain/appointment/appointment.js";
import type { CancellationReason } from "../domain/appointment/cancellationReason.js";

export type StorageError = Readonly<{ kind: "StorageError" }>;

export type AppointmentNotFound = Readonly<{
  kind: "AppointmentNotFound";
  appointmentId: string;
}>;

export type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: string;
  actualKind: Exclude<Appointment["kind"], "Scheduled" | "CheckedIn">;
}>;

export type CancelError =
  | StorageError
  | AppointmentNotFound
  | InvalidAppointmentState;

export type CancelInput = Readonly<{
  appointmentId: string;
  cancellationReason: CancellationReason;
}>;

export type CancelDependencies = Readonly<{
  resolver: Readonly<{
    resolveById: (
      appointmentId: string,
    ) => ResultAsync<Appointment | undefined, StorageError>;
  }>;
  store: Readonly<{
    save: (canceled: Canceled) => ResultAsync<void, StorageError>;
  }>;
  clock: Readonly<{ now: () => Date }>;
}>;

const ensureFound =
  (appointmentId: string) =>
  (
    appointment: Appointment | undefined,
  ): Result<Appointment, AppointmentNotFound> =>
    appointment === undefined
      ? err({ kind: "AppointmentNotFound", appointmentId })
      : ok(appointment);

const ensureCancellable = (
  appointment: Appointment,
): Result<Scheduled | CheckedIn, InvalidAppointmentState> =>
  appointment.kind === "Scheduled" || appointment.kind === "CheckedIn"
    ? ok(appointment)
    : err({
        kind: "InvalidAppointmentState",
        appointmentId: appointment.appointmentId,
        actualKind: appointment.kind,
      });

export const cancelAppointment =
  (deps: CancelDependencies) =>
  (input: CancelInput): ResultAsync<Canceled, CancelError> =>
    deps.resolver
      .resolveById(input.appointmentId)
      .andThen(ensureFound(input.appointmentId))
      .andThen(ensureCancellable)
      .map((appointment) =>
        cancel(appointment, input.cancellationReason, deps.clock.now()),
      )
      .andThrough(deps.store.save);
