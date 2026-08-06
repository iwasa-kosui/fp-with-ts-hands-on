import { z } from "zod";
import { err, ok, type Result } from "neverthrow";

import {
  Appointment,
  type Appointment as AppointmentValue,
  type CheckedIn,
  type InExamination,
} from "../domain/appointment.js";
import { AppointmentId, type AppointmentId as AppointmentIdValue } from "../domain/appointment-id.js";
import { ExaminationStarted } from "../domain/examination-started.js";
import { VeterinarianId } from "../domain/veterinarian-id.js";
import type { AppointmentRepository } from "../ports/appointment-repository.js";
import type { DomainEventStore } from "../ports/domain-event-store.js";
import { schemaResult, type ValidationError } from "../shared/schema-result.js";
import type { StartExaminationError } from "./start-examination-error.js";

const StartExaminationInputSchema = z.object({
  appointmentId: AppointmentId.schema,
  veterinarianId: VeterinarianId.schema,
  eventId: z.string(),
  occurredAt: z.string(),
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
  repository: AppointmentRepository,
  eventStore: DomainEventStore,
) => (raw: unknown): Result<InExamination, StartExaminationError> =>
  StartExaminationInput.parse(raw)
    .andThen((input) =>
      ensureFound(repository.findById(input.appointmentId), input.appointmentId)
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
    .map(({ input, examining }) => {
      repository.save(examining);
      eventStore.append(
        ExaminationStarted.create({
          eventId: input.eventId,
          occurredAt: input.occurredAt,
          appointmentId: examining.appointmentId,
          veterinarianId: examining.veterinarianId,
        }),
      );
      return examining;
    });
