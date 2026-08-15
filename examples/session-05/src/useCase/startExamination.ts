import { okAsync, type ResultAsync } from "neverthrow";

import type { EventContext } from "../domain/aggregate/eventContext.js";
import type { InExamination } from "../domain/appointment/appointment.js";
import { Appointment } from "../domain/appointment/transitions.js";
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
}>;

export const startExamination =
  (deps: Dependencies) =>
  (
    input: StartExaminationInput,
  ): ResultAsync<InExamination, StartExaminationError> =>
    okAsync<ReturnType<Dependencies["resolver"]["resolveById"]>, StartExaminationError>(
      deps.resolver.resolveById(input.appointmentId),
    )
      .andThen((appointment) =>
        ensureAppointmentFound(appointment, input.appointmentId),
      )
      .andThen(ensureCheckedIn)
      .map((appointment) => {
        const context = {
          eventId: deps.eventIdGenerator.generate(),
          occurredAt: deps.clock.now(),
        } as const satisfies EventContext;
        return Appointment.startExamination(context)(
          appointment,
          input.veterinarianId,
        );
      })
      .andThrough(deps.store.store)
      .map((event) => event.aggregateState);
