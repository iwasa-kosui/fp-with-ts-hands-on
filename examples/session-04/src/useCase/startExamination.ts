import { err, ok, type Result } from "neverthrow";

import type { ExaminationStarted } from "../domain/appointment/examinationStarted.js";
import { EventId } from "../domain/aggregate/eventId.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { VeterinarianId } from "../domain/ids/veterinarianId.js";
import type { Dependencies } from "./dependencies.js";
import type { EffectsStartExaminationError } from "./errors.js";
import { startExamination as startExaminationResult } from "./startExaminationResult.js";

export type StartExaminationInput = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
}>;

export const startExamination =
  (deps: Dependencies) =>
  async (
    input: StartExaminationInput,
  ): Promise<Result<void, EffectsStartExaminationError>> => {
    const occurredAt = new Date().toISOString();
    const result = startExaminationResult({
      resolver: deps.resolver,
      transition: deps.transition,
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

    try {
      await deps.stateStore.save(event.aggregateState);
      await deps.eventLog.append(event);
      return ok(undefined);
    } catch (cause) {
      return err({ kind: "RepositoryError", cause });
    }
  };
