import { err, ok, type Result } from "neverthrow";
import { z } from "zod";

import {
  Appointment,
  type Appointment as AppointmentValue,
  type CheckedIn,
  type InExamination,
} from "../domain/appointment.js";
import {
  AppointmentId,
  type AppointmentId as AppointmentIdValue,
} from "../domain/appointment-id.js";
import { EventId } from "../domain/event-id.js";
import { ExaminationStarted } from "../domain/examination-started.js";
import { Timestamp } from "../domain/timestamp.js";
import { VeterinarianId } from "../domain/veterinarian-id.js";
import type { AppointmentResolver } from "../ports/appointment-resolver.js";
import type { AppointmentStore } from "../ports/appointment-store.js";
import { schemaResult } from "../shared/schema-result.js";
import type { StartExaminationError } from "./start-examination-error.js";

const StartExaminationInputSchema = z.object({
  appointmentId: AppointmentId.schema,
  veterinarianId: VeterinarianId.schema,
  eventId: EventId.schema,
  occurredAt: Timestamp.schema,
});

export type StartExaminationInput = z.infer<typeof StartExaminationInputSchema>;

export const StartExaminationInput = {
  schema: StartExaminationInputSchema,
  parse: schemaResult(StartExaminationInputSchema),
} as const;

type AppointmentNotFound = Readonly<{
  kind: "AppointmentNotFound";
  appointmentId: AppointmentIdValue;
}>;

type InvalidAppointmentState = Readonly<{
  kind: "InvalidAppointmentState";
  appointmentId: AppointmentIdValue;
  actualKind: AppointmentValue["kind"];
  expectedKind: "CheckedIn";
}>;

const ensureFound = (
  appointment: AppointmentValue | undefined,
  appointmentId: AppointmentIdValue,
): Result<AppointmentValue, AppointmentNotFound> =>
  appointment === undefined
    ? err({ kind: "AppointmentNotFound", appointmentId })
    : ok(appointment);

const ensureCheckedIn = (
  appointment: AppointmentValue,
): Result<CheckedIn, InvalidAppointmentState> =>
  appointment.kind === "CheckedIn"
    ? ok(appointment)
    : err({
        kind: "InvalidAppointmentState",
        appointmentId: appointment.appointmentId,
        actualKind: appointment.kind,
        expectedKind: "CheckedIn",
      });

export const startExaminationUseCase = (
  resolver: AppointmentResolver,
  store: AppointmentStore,
) => (raw: unknown): Result<InExamination, StartExaminationError> =>
  StartExaminationInput.parse(raw)
    .andThen((input) =>
      resolver
        .findById(input.appointmentId)
        .andThen((appointment) => ensureFound(appointment, input.appointmentId))
        .andThen(ensureCheckedIn)
        .map((checkedIn) => ({ input, checkedIn })),
    )
    .map(({ input, checkedIn }) => ({
      input,
      examining: Appointment.startExamination(
        checkedIn,
        input.veterinarianId,
        input.occurredAt,
      ),
    }))
    .andThrough(({ input, examining }) =>
      store.save(examining, [
        ExaminationStarted.create({
          eventId: input.eventId,
          occurredAt: input.occurredAt,
          appointmentId: examining.appointmentId,
          veterinarianId: examining.veterinarianId,
        }),
      ]),
    )
    .map(({ examining }) => examining);
