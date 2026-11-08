import { ResultAsync, type Result } from "neverthrow";

import type { EventContext } from "../domain/aggregate/eventContext.js";
import type { Appointment as AppointmentState, CheckedIn, InExamination } from "../domain/appointment/index.js";
import type { ExaminationStarted } from "../domain/appointment/index.js";
import { Appointment, startExamination as transitionToInExamination } from "../domain/appointment/index.js";
import type { AppointmentId } from "../domain/appointment/index.js";
import type { VeterinarianId } from "../domain/appointment/index.js";
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

export const createEventContext = (
  deps: EventContextDependencies,
): EventContext => ({
  eventId: deps.eventIdGenerator.generate(),
  occurredAt: deps.clock.now(),
});

const resolveAppointment =
  (deps: EffectsDependencies) =>
  (appointmentId: AppointmentId): ResultAsync<AppointmentState | undefined, never> =>
    ResultAsync.fromSafePromise(
      Promise.resolve().then(() => deps.resolver.resolveById(appointmentId)),
    );

const ensureFound =
  (appointmentId: AppointmentId) =>
  (appointment: AppointmentState | undefined) =>
    ensureAppointmentFound(appointment, appointmentId);

const startExaminationEvent =
  (deps: EffectsDependencies, veterinarianId: VeterinarianId) =>
  (appointment: CheckedIn): ExaminationStarted =>
    Appointment.startExamination(createEventContext(deps))(
      appointment,
      veterinarianId,
    );

export const startExaminationWithEffects =
  (deps: EffectsDependencies) =>
  (
    input: StartExaminationWithEffectsInput,
  ): ResultAsync<InExamination, StartExaminationWithEffectsError> =>
    // ラボ結果到着は別の trigger から始まるため、この診察開始 workflow へ接続しません。
    resolveAppointment(deps)(input.appointmentId)
      .andThen(ensureFound(input.appointmentId))
      .andThen(ensureCheckedIn)
      .map(startExaminationEvent(deps, input.veterinarianId))
      .andThrough(deps.examinationStartedStore.store)
      .map((event) => event.aggregateState);
