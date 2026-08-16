import { ResultAsync, type Result } from "neverthrow";

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
} from "./dependencies.js";
import {
  ensureAppointmentFound,
  ensureCheckedIn,
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

export const startExaminationWithEffects =
  (deps: EffectsDependencies) =>
  (
    input: StartExaminationWithEffectsInput,
  ): ResultAsync<InExamination, StartExaminationWithEffectsError> =>
    // ラボ結果到着は別の trigger から始まるため、この診察開始 workflow へ接続しません。
    ResultAsync.fromSafePromise<AppointmentState | undefined>(
      Promise.resolve().then(() =>
        deps.resolver.resolveById(input.appointmentId),
      ),
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
      .andThrough((event) => deps.store.store(event))
      .map((event) => event.aggregateState);
