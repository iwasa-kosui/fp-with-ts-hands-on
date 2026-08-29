import { err, ok } from "neverthrow";
import type { ExaminationStarted } from "../domain/appointment/examinationStarted.js";
import { EventId } from "../domain/aggregate/eventId.js";
import type { EffectsDependencies } from "./dependencies.js";
import type { StartExaminationWithEffectsError } from "./errors.js";

import type { Result } from "neverthrow";

import type { InExamination } from "../domain/appointment/appointment.js";
import { startExamination as transitionToInExamination } from "../domain/appointment/transitions.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { VeterinarianId } from "../domain/ids/veterinarianId.js";
import type { Dependencies } from "./dependencies.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
  type StartExaminationError,
} from "./errors.js";

export type StartExaminationInput = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export const startExamination =
  (deps: Dependencies) =>
  (input: StartExaminationInput): Result<InExamination, StartExaminationError> =>
    ensureAppointmentFound(
      deps.resolver.resolveById(input.appointmentId),
      input.appointmentId,
    )
      .andThen(ensureCheckedIn)
      .map((appointment) =>
        transitionToInExamination(
          appointment,
          input.veterinarianId,
          input.examinationStartedAt,
        ),
      )
      .map((appointment) => {
        deps.store.save(appointment);
        return appointment;
      });

export const startExaminationWithEffects =
  (deps: EffectsDependencies) =>
  async (
    input: Omit<StartExaminationInput, "examinationStartedAt">,
  ): Promise<Result<void, StartExaminationWithEffectsError>> => {
    const occurredAt = new Date().toISOString();
    const result = startExamination({
      resolver: deps.resolver,
      store: { save: () => undefined },
    })({ ...input, examinationStartedAt: occurredAt });

    if (result.isErr()) {
      return err(result.error);
    }

    const event = {
      kind: "ExaminationStarted",
      eventId: EventId.parse(crypto.randomUUID()),
      occurredAt,
      appointmentId: result.value.appointmentId,
      aggregateState: result.value,
    } as const satisfies ExaminationStarted;

    await deps.stateStore.save(event.aggregateState);
    await deps.eventLog.append(event);
    return ok(undefined);
  };
