import { okAsync, type Result, type ResultAsync } from "neverthrow";

import type { EventContext } from "../domain/aggregate/eventContext.js";
import type { Appointment as AppointmentState, InExamination } from "../domain/appointment/appointment.js";
import type { ExaminationStarted } from "../domain/appointment/examinationStarted.js";
import { Appointment } from "../domain/appointment/transitions.js";
import type { AppointmentId } from "../domain/ids/appointmentId.js";
import type { VeterinarianId } from "../domain/ids/veterinarianId.js";
import type {
  Dependencies,
  EffectsDependencies,
  EventContextDependencies,
  ExaminationStartedStore,
} from "./dependencies.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
  toRepositoryError,
  type RepositoryError,
  type StartExaminationError,
  type StartExaminationWithEffectsError,
} from "./errors.js";

export type StartExaminationInput = Readonly<{
  appointmentId: AppointmentId;
  veterinarianId: VeterinarianId;
  examinationStartedAt: string;
}>;

export type StartExaminationWithEffectsInput = Omit<
  StartExaminationInput,
  "examinationStartedAt"
>;

export const startExamination =
  (deps: Dependencies) =>
  (input: StartExaminationInput): Result<InExamination, StartExaminationError> =>
    ensureAppointmentFound(
      deps.resolver.resolveById(input.appointmentId),
      input.appointmentId,
    )
      .andThen(ensureCheckedIn)
      .map((appointment) =>
        deps.transition(
          appointment,
          input.veterinarianId,
          input.examinationStartedAt,
        ),
      )
      .map((appointment) => {
        deps.store.save(appointment);
        return appointment;
      });

export const createEventContext = (
  deps: EventContextDependencies,
): EventContext => ({
  eventId: deps.eventIdGenerator.generate(),
  occurredAt: deps.clock.now(),
});

export const storeExaminationStarted =
  (store: ExaminationStartedStore) =>
  (event: ExaminationStarted): ResultAsync<void, RepositoryError> =>
    store.store(event).mapErr(toRepositoryError);

export const startExaminationWithEffects =
  (deps: EffectsDependencies) =>
  (
    input: StartExaminationWithEffectsInput,
  ): ResultAsync<InExamination, StartExaminationWithEffectsError> =>
    okAsync<AppointmentState | undefined, StartExaminationWithEffectsError>(
      deps.resolver.resolveById(input.appointmentId),
    )
      .andThen((appointment) =>
        ensureAppointmentFound(appointment, input.appointmentId),
      )
      .andThen(ensureCheckedIn)
      .map((appointment) =>
        Appointment.startExamination(createEventContext(deps))(
          appointment,
          input.veterinarianId,
        ),
      )
      .andThrough(storeExaminationStarted(deps.store))
      .map((event) => event.aggregateState);
